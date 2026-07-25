#!/usr/bin/env tsx
// Enforces the module `owns: [...]` manifests declared in
// apps/api/src/modules/index.ts: no module's service may read or write a
// Postgres table it doesn't own, except `reports` (and other names in
// READ_ONLY_CROSS_MODULE_ALLOWLIST below), which may read — never write —
// across module boundaries for aggregation/reporting purposes.
//
// `apps/api/src/core/**` is intentionally out of scope: it's the shared
// platform layer (auth, permissions, tenant settings) that every domain
// module already depends on without an `owns` entry.

import { readFileSync, readdirSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(__dirname, '..')
const schemaDir = path.join(repoRoot, 'packages/database/src/schema')
const modulesDir = path.join(repoRoot, 'apps/api/src/modules')

const READ_ONLY_CROSS_MODULE_ALLOWLIST = new Set(['reports'])
const EXCLUDED_MODULE_NAMES = new Set(['hotel', 'retail'])

type Violation = { kind: 'error' | 'read' | 'write'; message: string }

function walk(dir: string, predicate: (file: string) => boolean): string[] {
  const out: string[] = []
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) out.push(...walk(full, predicate))
    else if (predicate(full)) out.push(full)
  }
  return out
}

// --- 1. Build the table registry: camelCase export name -> snake_case table name.
const schemaFiles = walk(schemaDir, (f) => f.endsWith('.ts'))
const tableExportToName = new Map<string, string>()
const pgTablePattern = /export const (\w+) = pgTable\(\s*['"]([a-z_]+)['"]/g
for (const file of schemaFiles) {
  const content = readFileSync(file, 'utf8')
  for (const match of content.matchAll(pgTablePattern)) {
    tableExportToName.set(match[1]!, match[2]!)
  }
}
const knownTableNames = new Set(tableExportToName.values())

// --- 2. Discover each module's `owns: [...]` manifest by parsing source text
// (regex, not a runtime import — the module tree is decorator-heavy NestJS
// code that requires apps/api's own tsconfig to transform; importing it from
// a root-level script fights esbuild's decorator handling for no benefit).
const manifestBlockPattern = /export const \w+Module = \{([\s\S]*?)\} as const/g
const namePattern = /name:\s*'([\w-]+)'/
const ownsPattern = /owns:\s*(\[[\s\S]*?\])/
const quotedString = /['"]([\w-]+)['"]/g

type ModuleManifest = { name: string; owns: string[] }
const allManifests: ModuleManifest[] = []
const manifestFiles = walk(modulesDir, (f) => f.endsWith('.ts'))
for (const file of manifestFiles) {
  const content = readFileSync(file, 'utf8')
  for (const block of content.matchAll(manifestBlockPattern)) {
    const body = block[1]!
    const name = body.match(namePattern)?.[1]
    const ownsRaw = body.match(ownsPattern)?.[1]
    if (!name || !ownsRaw) continue
    const owns = [...ownsRaw.matchAll(quotedString)].map((m) => m[1]!)
    allManifests.push({ name, owns })
  }
}

// --- 3. Build the table -> owning module map from the manifests, and validate them.
const violations: Violation[] = []
const tableOwner = new Map<string, string>()
const checkedModules = allManifests.filter((m) => !EXCLUDED_MODULE_NAMES.has(m.name))

for (const mod of checkedModules) {
  for (const table of mod.owns as readonly string[]) {
    if (!knownTableNames.has(table)) {
      violations.push({
        kind: 'error',
        message: `module '${mod.name}' claims table '${table}' in its owns manifest, but no such table exists in packages/database/src/schema`,
      })
      continue
    }
    const existingOwner = tableOwner.get(table)
    if (existingOwner && existingOwner !== mod.name) {
      violations.push({
        kind: 'error',
        message: `table '${table}' is claimed by both '${existingOwner}' and '${mod.name}' — ownership must be unique`,
      })
      continue
    }
    tableOwner.set(table, mod.name)
  }
}

// --- 4. Scan every module's service files for cross-module table access.
const importBlockPattern = /import\s*\{([^}]+)\}\s*from\s*['"]@hospitality-os\/database['"]/gs

for (const mod of checkedModules) {
  const moduleDir = path.join(modulesDir, mod.name)
  let serviceFiles: string[]
  try {
    serviceFiles = walk(moduleDir, (f) => f.endsWith('.service.ts'))
  } catch {
    continue // module has no folder of its own (shouldn't happen, but don't crash the check over it)
  }

  for (const file of serviceFiles) {
    const relFile = path.relative(repoRoot, file)
    const content = readFileSync(file, 'utf8')

    const localToCanonical = new Map<string, string>()
    for (const importMatch of content.matchAll(importBlockPattern)) {
      const specifiers = importMatch[1]!.split(',').map((s) => s.trim()).filter(Boolean)
      for (const spec of specifiers) {
        const asMatch = spec.match(/^(\w+)\s+as\s+(\w+)$/)
        if (asMatch) localToCanonical.set(asMatch[2]!, asMatch[1]!)
        else localToCanonical.set(spec, spec)
      }
    }

    for (const [localName, canonical] of localToCanonical) {
      const tableName = tableExportToName.get(canonical)
      if (!tableName) continue // not a table export (e.g. withTenantContext, a type, a helper)

      const escaped = localName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      const isRead =
        new RegExp(`\\.from\\(\\s*${escaped}\\b`).test(content) ||
        new RegExp(`\\.(inner|left|right|full)Join\\(\\s*${escaped}\\b`).test(content)
      const isWrite =
        new RegExp(`\\.insert\\(\\s*${escaped}\\b`).test(content) ||
        new RegExp(`\\.update\\(\\s*${escaped}\\b`).test(content) ||
        new RegExp(`\\.delete\\(\\s*${escaped}\\b`).test(content)
      if (!isRead && !isWrite) continue

      const owner = tableOwner.get(tableName)
      if (!owner) {
        violations.push({
          kind: 'error',
          message: `${relFile} accesses table '${tableName}' which has no declared owner in any module's owns manifest`,
        })
        continue
      }
      if (owner === mod.name) continue // in-bounds

      if (isWrite) {
        violations.push({
          kind: 'write',
          message: `${relFile} writes table '${tableName}' (owned by '${owner}') — cross-module writes are never allowed`,
        })
      } else if (isRead && !READ_ONLY_CROSS_MODULE_ALLOWLIST.has(mod.name)) {
        violations.push({
          kind: 'read',
          message: `${relFile} reads table '${tableName}' (owned by '${owner}') — go through ${owner}'s exported service instead`,
        })
      }
    }
  }
}

// --- 5. Report.
if (violations.length === 0) {
  console.log(`check-module-boundaries: clean (${checkedModules.length} modules, ${knownTableNames.size} tables checked)`)
  process.exit(0)
}

console.error(`check-module-boundaries: ${violations.length} violation(s) found\n`)
for (const v of violations) console.error(`  [${v.kind}] ${v.message}`)
process.exit(1)

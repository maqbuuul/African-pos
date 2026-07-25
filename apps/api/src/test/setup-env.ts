import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

// vitest doesn't load `.env` the way `tsx --env-file` does for `pnpm dev` —
// populate process.env from the repo-root .env so tests can reach the same
// local Postgres/Redis every other dev workflow uses. Never overrides a
// value already set (e.g. by CI secrets).
const envPath = resolve(import.meta.dirname, '../../../../.env')

if (existsSync(envPath)) {
  const content = readFileSync(envPath, 'utf8')
  for (const line of content.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eq = trimmed.indexOf('=')
    if (eq === -1) continue
    const key = trimmed.slice(0, eq).trim()
    let value = trimmed.slice(eq + 1).trim()
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1)
    }
    if (!(key in process.env)) process.env[key] = value
  }
}

import { defineConfig } from 'drizzle-kit'

export default defineConfig({
  // Loaded from the built output, not src/*.ts directly — drizzle-kit's CJS
  // require()-based loader doesn't resolve the project's explicit `.js`
  // extension relative imports (needed for real Node ESM at runtime) against
  // .ts source files. Run `pnpm build` before `db:generate` if the schema
  // changed.
  schema: './dist/schema/index.js',
  out: './src/migrations',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env['DATABASE_URL'] ?? 'postgresql://pos_user:pos_password@localhost:5432/hospitality_os_dev',
  },
})


import type { Config } from 'drizzle-kit'

export default {
  schema: './src/shared/database/schema/index.ts',
  out: './drizzle/migrations',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env['DATABASE_URL'] ?? 'postgresql://pos_user:pos_password@localhost:5432/african_pos_dev',
  },
} satisfies Config

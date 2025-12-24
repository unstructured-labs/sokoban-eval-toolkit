import { defineConfig } from 'drizzle-kit'

export default defineConfig({
  schema: '../../packages/db/src/schema.ts',
  out: './drizzle',
  dialect: 'sqlite',
  dbCredentials: {
    url: 'db.sqlite',
  },
})

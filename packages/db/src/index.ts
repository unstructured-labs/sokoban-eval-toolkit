/// <reference types="bun-types" />

import { Database } from 'bun:sqlite'
import { drizzle } from 'drizzle-orm/bun-sqlite'
import * as schema from './schema'

const sqlite = new Database('db.sqlite')
export const db = drizzle(sqlite, { schema })

export * from './schema'

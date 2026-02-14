import { drizzle } from 'drizzle-orm/node-postgres';
import pg from 'pg';
import * as schema from './schema.js';
import { env } from '../config/env.js';

const { Pool } = pg;

/** PostgreSQL connection pool */
export const pool = new Pool({
  connectionString: env.DATABASE_URL,
});

/** Drizzle ORM instance with typed schema */
export const db = drizzle({ client: pool, schema });

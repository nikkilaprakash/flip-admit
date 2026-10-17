import path from "path";
import fs from "fs";
import * as schema from "./schema";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";

export type DB = PgDatabase<PgQueryResultHKT, typeof schema>;

const g = globalThis as unknown as { __faDb?: Promise<DB> };

/**
 * DATABASE_URL set  -> PostgreSQL server via node-postgres (production).
 * DATABASE_URL unset -> embedded PostgreSQL (PGlite) persisted in ./data/pglite, zero setup.
 * Migrations in ./drizzle run once on first connection.
 */
async function connect(): Promise<DB> {
  const migrationsFolder = path.join(process.cwd(), "drizzle");
  if (process.env.DATABASE_URL) {
    const { Pool } = await import("pg");
    const { drizzle } = await import("drizzle-orm/node-postgres");
    const { migrate } = await import("drizzle-orm/node-postgres/migrator");
    const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 10 });
    const db = drizzle(pool, { schema });
    await migrate(db, { migrationsFolder });
    return db as unknown as DB;
  }
  const { PGlite } = await import("@electric-sql/pglite");
  const { drizzle } = await import("drizzle-orm/pglite");
  const { migrate } = await import("drizzle-orm/pglite/migrator");
  const dir = path.resolve(process.env.PGLITE_DIR || "./data/pglite");
  fs.mkdirSync(dir, { recursive: true });
  const client = new PGlite(dir);
  const db = drizzle(client, { schema });
  await migrate(db, { migrationsFolder });
  return db as unknown as DB;
}

export function getDb(): Promise<DB> {
  if (!g.__faDb) g.__faDb = connect().catch((e) => { g.__faDb = undefined; throw e; });
  return g.__faDb;
}

export { schema };

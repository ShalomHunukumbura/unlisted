import { Pool } from "pg";

// Module-level pool, reused across requests (and across HMR reloads in dev).
const globalForPg = globalThis as unknown as { pgPool?: Pool };

export const pool =
  globalForPg.pgPool ??
  new Pool({
    connectionString:
      process.env.DATABASE_URL ??
      "postgresql://jobsite:jobsite@localhost:5433/jobsite",
    max: 8,
  });

if (process.env.NODE_ENV !== "production") globalForPg.pgPool = pool;

export async function query<T = Record<string, unknown>>(
  text: string,
  params: unknown[] = [],
): Promise<T[]> {
  const res = await pool.query(text, params);
  return res.rows as T[];
}

/**
 * A query with JIT compilation off. Postgres JIT-compiles any query its
 * planner guesses is expensive; for the "For you" ranking the guess is far off
 * and compiling took 2 s for an 80 ms query.
 */
export async function queryNoJit<T = Record<string, unknown>>(
  text: string,
  params: unknown[] = [],
): Promise<T[]> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("SET LOCAL jit = off");
    const res = await client.query(text, params);
    await client.query("COMMIT");
    return res.rows as T[];
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    throw error;
  } finally {
    client.release();
  }
}

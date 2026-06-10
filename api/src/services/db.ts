/** PostgreSQL connection pool and query helpers. */
import pg from 'pg'

const pool = new pg.Pool({
  host: process.env.PGHOST ?? 'localhost',
  port: Number(process.env.PGPORT ?? 5432),
  database: process.env.PGDATABASE ?? 'codehive',
  user: process.env.PGUSER ?? 'codehive',
  password: process.env.PGPASSWORD ?? 'codehive',
  max: Number(process.env.PGPOOL_MAX ?? 10),
  idleTimeoutMillis: 30000,
})

pool.on('error', (err) => {
  console.error('PG pool error', err)
})

/** Executes parameterised query on pool, logs in dev mode. */
export async function query(text: string, params?: unknown[]) {
  const start = Date.now()
  const res = await pool.query(text, params)
  const duration = Date.now() - start
  if (process.env.NODE_ENV === 'development') {
    console.log('query', { text: text.slice(0, 80), duration })
  }
  return res
}

/** Acquires dedicated client from pool. */
export async function getClient() {
  const client = await pool.connect()
  return client
}

/** Checks DB connectivity via SELECT 1. */
export async function healthCheck(): Promise<boolean> {
  try {
    await query('SELECT 1')
    return true
  } catch {
    return false
  }
}

/** Closes all pool connections. */
export async function closePool() {
  await pool.end()
}

export { pool }

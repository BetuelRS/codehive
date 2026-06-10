/** PostgreSQL connection pool and query helpers. */
import pg from 'pg'

let pool: pg.Pool | null = null

function getPool(): pg.Pool {
  if (!pool) {
    pool = new pg.Pool({
      host: process.env.PGHOST ?? 'localhost',
      port: Number(process.env.PGPORT ?? 5432),
      database: process.env.PGDATABASE ?? 'codehive',
      user: process.env.PGUSER ?? 'codehive',
      password: process.env.PGPASSWORD ?? 'codehive',
      max: Number(process.env.PGPOOL_MAX ?? 10),
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 3000,
    })
    pool.on('error', (err: Error & { code?: string }) => {
      if (err.code === 'ECONNREFUSED') return
      console.error('PG pool error', err)
    })
  }
  return pool
}

export async function query(text: string, params?: unknown[]) {
  const p = getPool()
  const start = Date.now()
  const res = await p.query(text, params)
  const duration = Date.now() - start
  if (process.env.NODE_ENV === 'development') {
    console.log('query', { text: text.slice(0, 80), duration })
  }
  return res
}

export async function getClient() {
  return getPool().connect()
}

export async function healthCheck(): Promise<boolean> {
  try {
    await query('SELECT 1')
    return true
  } catch {
    return false
  }
}

export async function closePool() {
  if (pool) await pool.end()
}

export { pool }

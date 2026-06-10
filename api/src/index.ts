import 'dotenv/config'
import Fastify from 'fastify'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { readFileSync, existsSync } from 'node:fs'
import { registerCors } from './plugins/cors.js'
import { registerWebSocket } from './plugins/ws.js'
import { registerAuth } from './plugins/auth.js'
import { registerRateLimit } from './plugins/rate-limit.js'
import { rootRoutes } from './routes/root.js'
import { healthRoutes } from './routes/health.js'
import { executeRoutes } from './routes/execute.js'
import { executionsRoutes } from './routes/executions.js'
import { workerRoutes } from './routes/workers.js'
import { workerApiRoutes } from './routes/worker-api.js'
import { closePool } from './services/db.js'
import { closeRedis } from './services/queue.js'
import { wsObserver } from './services/ws-observer.js'

const PORT = Number(process.env.PORT ?? 3001)
const HOST = process.env.HOST ?? '0.0.0.0'

const app = Fastify({
  logger: {
    transport: process.env.NODE_ENV === 'development'
      ? { target: 'pino-pretty', options: { colorize: true } }
      : undefined,
  },
})

async function start(): Promise<void> {
  await registerCors(app)
  await registerAuth(app)
  await registerRateLimit(app)
  await registerWebSocket(app)

  await app.register(rootRoutes)
  await app.register(healthRoutes)
  await app.register(executeRoutes)
  await app.register(executionsRoutes)
  await app.register(workerRoutes)
  await app.register(workerApiRoutes)

  // Serve dashboard static files in production
  if (process.env.NODE_ENV === 'production') {
    const __dirname = dirname(fileURLToPath(import.meta.url))
    const distPath = join(__dirname, '..', '..', 'dashboard', 'dist')
    if (existsSync(distPath)) {
      const serveStatic = async (_req: any, reply: any) => {
        const indexPath = join(distPath, 'index.html')
        if (existsSync(indexPath)) {
          return reply.type('text/html').send(readFileSync(indexPath, 'utf-8'))
        }
        return reply.type('text/html').send('CodeHive Dashboard — run <code>npm run build</code> in dashboard/')
      }
      app.get('/*', serveStatic)
    }
  }

  wsObserver.init(app)

  try {
    await app.listen({ port: PORT, host: HOST })
    app.log.info({ host: HOST, port: PORT }, 'server started')
  } catch (err) {
    app.log.error(err, 'failed to start')
    process.exit(1)
  }
}

async function shutdown(signal: string): Promise<void> {
  app.log.info({ signal }, 'shutting down')
  wsObserver.destroy()
  await app.close()
  await closePool()
  await closeRedis()
}

process.on('SIGINT', () => shutdown('SIGINT'))
process.on('SIGTERM', () => shutdown('SIGTERM'))

start()

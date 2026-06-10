/** CodeHive API server entry point. Registers plugins, routes, WebSocket, starts listener. */
import 'dotenv/config'
import Fastify from 'fastify'
import { registerCors } from './plugins/cors.js'
import { registerWebSocket } from './plugins/ws.js'
import { healthRoutes } from './routes/health.js'
import { executeRoutes } from './routes/execute.js'
import { workerRoutes } from './routes/workers.js'
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

/** Initialises Fastify app, registers plugins/routes, starts HTTP server. */
async function start(): Promise<void> {
  await registerCors(app)
  await registerWebSocket(app)

  await app.register(healthRoutes)
  await app.register(executeRoutes)
  await app.register(workerRoutes)

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

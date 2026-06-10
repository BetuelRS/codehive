import { FastifyInstance } from 'fastify'

export async function registerAuth(app: FastifyInstance): Promise<void> {
  const apiKey = process.env.API_KEY
  if (!apiKey) {
    app.log.warn('API_KEY not set — auth disabled for development')
    return
  }

  app.addHook('onRequest', async (req, reply) => {
    const publicPaths = ['/api/health', '/api/ws']
    if (publicPaths.some((p) => req.url.startsWith(p))) return
    if (req.url === '/') return

    const key = req.headers['x-api-key']
    if (!key || key !== apiKey) {
      return reply.status(401).send({ error: 'Unauthorized' })
    }
  })
}

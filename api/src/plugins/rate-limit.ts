import { FastifyInstance } from 'fastify'
import rateLimit from '@fastify/rate-limit'

export async function registerRateLimit(app: FastifyInstance): Promise<void> {
  await app.register(rateLimit, {
    max: 10,
    timeWindow: '1 minute',
    errorResponseBuilder: (_req, context) => ({
      statusCode: 429,
      error: 'Too Many Requests',
      message: `Rate limit exceeded. Max ${context.max} requests per ${context.after}.`,
    }),
  })
}

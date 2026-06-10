import { FastifyInstance } from 'fastify'
import cors from '@fastify/cors'

/** Registers CORS plugin with origin from env or wildcard. */
export async function registerCors(app: FastifyInstance): Promise<void> {
  await app.register(cors, {
    origin: process.env.CORS_ORIGIN?.split(',') ?? '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    credentials: true,
  })
}

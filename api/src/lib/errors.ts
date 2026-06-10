import { FastifyReply } from 'fastify'

export class AppError extends Error {
  constructor(
    public statusCode: number,
    public code: string,
    message: string,
  ) {
    super(message)
    this.name = 'AppError'
  }
}

export class ValidationError extends AppError {
  constructor(message: string, public details?: unknown) {
    super(400, 'ValidationError', message)
    this.name = 'ValidationError'
  }
}

export class NotFoundError extends AppError {
  constructor(resource: string, id: string) {
    super(404, `${resource}NotFound`, `${resource} ${id} not found`)
    this.name = 'NotFoundError'
  }
}

export function sendError(reply: FastifyReply, err: Error) {
  if (err instanceof AppError) {
    return reply.code(err.statusCode).send({
      error: err.code,
      message: err.message,
      ...(err instanceof ValidationError && err.details ? { details: err.details } : {}),
    })
  }
  return reply.code(500).send({ error: 'InternalError', message: 'Internal server error' })
}

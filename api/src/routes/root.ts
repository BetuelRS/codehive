import { FastifyInstance } from 'fastify'

const pkg = { version: '1.0.0', name: 'codehive-api' }

export async function rootRoutes(app: FastifyInstance): Promise<void> {
  app.get('/', async (_req, reply) => {
    return reply.type('text/html').send(`<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><title>CodeHive API</title>
<meta name="viewport" content="width=device-width, initial-scale=1">
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: system-ui, -apple-system, sans-serif; background: #0d1117; color: #c9d1d9; display: flex; align-items: center; justify-content: center; min-height: 100vh; }
  .card { background: #161b22; border: 1px solid #30363d; border-radius: 12px; padding: 40px; max-width: 520px; width: 90%; text-align: center; }
  h1 { font-size: 28px; font-weight: 700; margin-bottom: 4px; color: #58a6ff; }
  .sub { color: #8b949e; font-size: 14px; margin-bottom: 24px; }
  .status { display: inline-flex; align-items: center; gap: 6px; padding: 6px 16px; border-radius: 999px; font-size: 13px; font-weight: 500; background: #0d4429; color: #3fb950; border: 1px solid #2ea043; margin-bottom: 24px; }
  .status .dot { width: 8px; height: 8px; border-radius: 50%; background: #3fb950; }
  .links { display: flex; flex-direction: column; gap: 8px; }
  .links a { color: #58a6ff; text-decoration: none; padding: 8px 16px; border: 1px solid #30363d; border-radius: 8px; font-size: 14px; transition: background .15s; }
  .links a:hover { background: #1c2128; border-color: #58a6ff; }
  .badge { display: inline-block; padding: 2px 8px; border-radius: 4px; font-size: 11px; background: #1f2937; color: #8b949e; margin-top: 20px; }
</style>
</head>
<body>
<div class="card">
  <h1>CodeHive</h1>
  <p class="sub">${pkg.name} v${pkg.version}</p>
  <div class="status"><span class="dot"></span> All systems operational</div>
  <div class="links">
    <a href="/api/health">Health Check</a>
    <a href="/api/workers">Workers</a>
    <a href="/api/executions">Executions</a>
    <a href="https://github.com/codehive/codehive">GitHub</a>
  </div>
  <div class="badge">Multi-language code execution orchestrator</div>
</div>
</body>
</html>`)
  })
}

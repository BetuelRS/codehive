import { spawn } from 'node:child_process'
import { writeFileSync, mkdtempSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import type { ExecutionResult } from '../types/index.js'
import { getJob, updateJob } from './queue.js'

interface LangCfg {
  cmd: string
  ext: string
  args?: string[]
}

const LANG_INTERPRETER: Record<string, LangCfg> = {
  python:     { cmd: 'python3',  ext: '.py' },
  javascript: { cmd: 'node',     ext: '.js' },
  typescript: { cmd: 'npx',      ext: '.ts', args: ['tsx'] },
  go:         { cmd: 'go',       ext: '.go', args: ['run'] },
  rust:       { cmd: 'rustc',    ext: '.rs' },
  java:       { cmd: 'java',     ext: '.java' },
  cpp:        { cmd: 'g++',      ext: '.cpp', args: ['-o', '/tmp/a.out'] },
}

export async function executeJob(jobId: string, language: string, code: string, stdin?: string, timeoutSec = 30): Promise<void> {
  const startedAt = new Date().toISOString()
  await updateJob(jobId, { status: 'running' })

  const cfg = LANG_INTERPRETER[language] ?? LANG_INTERPRETER['python']
  const dir = mkdtempSync(join(tmpdir(), 'ch-'))
  const file = join(dir, `code${cfg.ext}`)

  try {
    writeFileSync(file, code, 'utf-8')
    const startMs = Date.now()

    const result = await runProcess(cfg, file, stdin, timeoutSec)
    const durationMs = Date.now() - startMs

    const res: ExecutionResult = {
      id: jobId,
      status: result.exitCode === 0 ? 'completed' : 'failed',
      stdout: result.stdout,
      stderr: result.stderr,
      exitCode: result.exitCode,
      language,
      startedAt,
      finishedAt: new Date().toISOString(),
      durationMs,
      error: result.error || undefined,
    }

    const job = await getJob(jobId)
    if (job) {
      job.result = res
      job.status = res.status
    }
  } catch (err) {
    const res: ExecutionResult = {
      id: jobId,
      status: 'failed',
      stdout: '',
      stderr: '',
      exitCode: -1,
      language,
      startedAt,
      finishedAt: new Date().toISOString(),
      durationMs: 0,
      error: err instanceof Error ? err.message : String(err),
    }
    await updateJob(jobId, { status: 'failed', result: res })
  } finally {
    try { rmSync(dir, { recursive: true, force: true }) } catch { /* ignore */ }
  }
}

interface ProcResult {
  stdout: string
  stderr: string
  exitCode: number
  error?: string
}

function runProcess(cfg: LangCfg, file: string, stdin?: string, timeout = 30): Promise<ProcResult> {
  const args = [...(cfg.args ?? []), file]

  return new Promise((resolve) => {
    const proc = spawn(cfg.cmd, args, { stdio: ['pipe', 'pipe', 'pipe'] })
    const timeoutId = setTimeout(() => {
      proc.kill('SIGKILL')
      resolve({ stdout: '', stderr: 'Process killed: timeout exceeded', exitCode: -1, error: 'timeout' })
    }, timeout * 1000)

    let stdout = ''
    let stderr = ''

    proc.stdout.on('data', (d: Buffer) => { stdout += d.toString() })
    proc.stderr.on('data', (d: Buffer) => { stderr += d.toString() })

    if (stdin) { proc.stdin.write(stdin) }
    proc.stdin.end()

    proc.on('close', (code) => {
      clearTimeout(timeoutId)
      resolve({ stdout, stderr, exitCode: code ?? -1 })
    })
    proc.on('error', (err) => {
      clearTimeout(timeoutId)
      resolve({ stdout: '', stderr: err.message, exitCode: -1, error: err.message })
    })
  })
}

export { LANG_INTERPRETER }

import { describe, it, expect } from 'vitest'

function createExec(overrides: Record<string, unknown> = {}) {
  return {
    id: 'exec-1',
    language: 'python',
    code: 'print("hello")',
    stdin: '',
    stdout: 'hello\n',
    stderr: '',
    exitCode: 0,
    durationMs: 150,
    status: 'completed',
    createdAt: new Date().toISOString(),
    ...overrides,
  } as {
    id: string; language: string; code: string; stdin: string;
    stdout: string; stderr: string; exitCode: number; durationMs: number;
    status: string; createdAt: string; workerId?: string;
  }
}

describe('ExecutionCard render', () => {
  it('renders execution metadata', () => {
    const exec = createExec()
    const wrapper = document.createElement('div')
    wrapper.innerHTML = `
      <div class="card">
        <div class="header">
          <div class="meta">
            <span class="lang-tag">${exec.language}</span>
            <span class="badge">${exec.status}</span>
            <span class="duration">${exec.durationMs}ms</span>
          </div>
        </div>
      </div>`
    document.body.appendChild(wrapper)

    expect(wrapper.querySelector('.lang-tag')?.textContent).toBe('python')
    expect(wrapper.querySelector('.duration')?.textContent).toBe('150ms')

    document.body.removeChild(wrapper)
  })

  it('shows code in expanded view', () => {
    const exec = createExec()
    const wrapper = document.createElement('div')
    wrapper.innerHTML = `
      <div class="card expanded">
        <div class="body">
          <div class="section">
            <div class="section-title">Code</div>
            <pre class="code-block">${exec.code}</pre>
          </div>
          <div class="cols">
            <div class="section">
              <div class="section-title">Stdout</div>
              <pre class="code-block output">${exec.stdout}</pre>
            </div>
          </div>
          <div class="footer-meta">
            <span>Exit: ${exec.exitCode}</span>
            <span>ID: ${exec.id.slice(0, 8)}</span>
          </div>
        </div>
      </div>`
    document.body.appendChild(wrapper)

    expect(wrapper.querySelector('.code-block')?.textContent).toBe(exec.code)
    expect(wrapper.querySelector('.output')?.textContent).toBe(exec.stdout)
    expect(wrapper.querySelector('.footer-meta')?.textContent).toContain('Exit: 0')

    document.body.removeChild(wrapper)
  })

  it('shows stderr when present', () => {
    const exec = createExec({ stderr: 'Traceback (most recent call last)' })
    const wrapper = document.createElement('div')
    wrapper.innerHTML = `
      <div class="card expanded">
        <div class="body">
          <div class="cols">
            <div class="section">
              <div class="section-title">Stderr</div>
              <pre class="code-block error">${exec.stderr}</pre>
            </div>
          </div>
        </div>
      </div>`
    document.body.appendChild(wrapper)

    expect(wrapper.querySelector('.error')?.textContent).toContain('Traceback')

    document.body.removeChild(wrapper)
  })

  it('shows stdin section when stdin exists', () => {
    const exec = createExec({ stdin: 'hello world' })
    const wrapper = document.createElement('div')
    wrapper.innerHTML = `
      <div class="card expanded">
        <div class="body">
          <div class="section">
            <div class="section-title">Stdin</div>
            <pre class="code-block">${exec.stdin}</pre>
          </div>
        </div>
      </div>`
    document.body.appendChild(wrapper)

    expect(wrapper.querySelector('.section-title')?.textContent).toBe('Stdin')

    document.body.removeChild(wrapper)
  })

  it('shows worker ID when available', () => {
    const exec = createExec({ workerId: 'worker-1' })
    const wrapper = document.createElement('div')
    wrapper.innerHTML = `
      <div class="card expanded">
        <div class="body">
          <div class="footer-meta">
            <span>Worker: ${exec.workerId}</span>
          </div>
        </div>
      </div>`
    document.body.appendChild(wrapper)

    expect(wrapper.querySelector('.footer-meta')?.textContent).toContain('Worker: worker-1')

    document.body.removeChild(wrapper)
  })
})

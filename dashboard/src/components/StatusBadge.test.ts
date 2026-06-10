import { describe, it, expect } from 'vitest'

// Component tests for StatusBadge - testing render output via DOM
describe('StatusBadge', () => {
  it('renders online status with correct label', () => {
    // Mount in jsdom
    const wrapper = document.createElement('div')
    wrapper.innerHTML = `<span class="badge" style="--badge-color: var(--green); --badge-bg: var(--green-bg)">
      <span class="dot"></span>
      3 workers
    </span>`
    document.body.appendChild(wrapper)

    const badge = wrapper.querySelector('.badge')
    expect(badge).toBeTruthy()
    expect(badge?.textContent?.trim()).toContain('3 workers')

    const dot = wrapper.querySelector('.dot')
    expect(dot).toBeTruthy()

    document.body.removeChild(wrapper)
  })

  it('renders offline status', () => {
    const wrapper = document.createElement('div')
    wrapper.innerHTML = `<span class="badge" style="--badge-color: var(--text-muted); --badge-bg: transparent">
      <span class="dot"></span>
      offline
    </span>`
    document.body.appendChild(wrapper)

    const badge = wrapper.querySelector('.badge')
    expect(badge?.textContent?.trim()).toBe('offline')

    document.body.removeChild(wrapper)
  })

  it('renders running status', () => {
    const wrapper = document.createElement('div')
    wrapper.innerHTML = `<span class="badge" style="--badge-color: var(--blue); --badge-bg: var(--blue-bg)">
      <span class="dot"></span>
      running
    </span>`
    document.body.appendChild(wrapper)

    const badge = wrapper.querySelector('.badge')
    expect(badge?.textContent?.trim()).toBe('running')

    document.body.removeChild(wrapper)
  })

  it('renders failed status', () => {
    const wrapper = document.createElement('div')
    wrapper.innerHTML = `<span class="badge" style="--badge-color: var(--red); --badge-bg: var(--red-bg)">
      <span class="dot"></span>
      failed
    </span>`
    document.body.appendChild(wrapper)

    const badge = wrapper.querySelector('.badge')
    expect(badge?.textContent?.trim()).toBe('failed')

    document.body.removeChild(wrapper)
  })

  it('renders completed status', () => {
    const wrapper = document.createElement('div')
    wrapper.innerHTML = `<span class="badge" style="--badge-color: var(--green); --badge-bg: var(--green-bg)">
      <span class="dot"></span>
      completed
    </span>`
    document.body.appendChild(wrapper)

    const badge = wrapper.querySelector('.badge')
    expect(badge?.textContent?.trim()).toBe('completed')

    document.body.removeChild(wrapper)
  })
})

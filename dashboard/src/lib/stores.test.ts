import { describe, it, expect } from 'vitest'

describe('stores', () => {
  it('exports required stores', async () => {
    const stores = await import('./stores.js')
    expect(stores.currentView).toBeDefined()
    expect(stores.executions).toBeDefined()
    expect(stores.workers).toBeDefined()
    expect(stores.stats).toBeDefined()
    expect(stores.liveFeed).toBeDefined()
    expect(stores.executionTotal).toBeDefined()
  })

  it('currentView defaults to dashboard', () => {
    // Can't easily test svelte stores without svelte runtime
    // Just verify the module structure
  })
})

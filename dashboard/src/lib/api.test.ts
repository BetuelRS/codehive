import { describe, it, expect } from 'vitest'
import { formatDuration, formatUptime, timeAgo } from './api.js'

describe('formatDuration', () => {
  it('formats milliseconds', () => {
    expect(formatDuration(500)).toBe('500ms')
  })

  it('formats seconds', () => {
    expect(formatDuration(1500)).toBe('1.5s')
  })

  it('formats minutes and seconds', () => {
    expect(formatDuration(125000)).toBe('2m 5s')
  })
})

describe('formatUptime', () => {
  it('formats minutes only', () => {
    expect(formatUptime(300)).toBe('5m')
  })

  it('formats hours and minutes', () => {
    expect(formatUptime(3720)).toBe('1h 2m')
  })

  it('formats days, hours, minutes', () => {
    expect(formatUptime(90000)).toBe('1d 1h 0m')
  })
})

describe('timeAgo', () => {
  it('formats seconds ago', () => {
    const now = new Date().toISOString()
    expect(timeAgo(now)).toMatch(/s ago/)
  })

  it('formats minutes ago', () => {
    const past = new Date(Date.now() - 120000).toISOString()
    expect(timeAgo(past)).toMatch(/m ago/)
  })

  it('formats hours ago', () => {
    const past = new Date(Date.now() - 7200000).toISOString()
    expect(timeAgo(past)).toMatch(/h ago/)
  })

  it('formats days ago', () => {
    const past = new Date(Date.now() - 172800000).toISOString()
    expect(timeAgo(past)).toMatch(/d ago/)
  })
})

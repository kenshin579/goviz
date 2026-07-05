import { describe, it, expect } from 'vitest'
import { makePalette } from './palette'

describe('makePalette', () => {
  it('standard dark palette matches the current app colors', () => {
    const p = makePalette('dark', false)
    expect(p.state).toEqual({ running: '#4caf50', runnable: '#9aa3b2', blocked: '#c25450' })
    expect(p.category).toEqual({ channel: '#5b8def', mutex: '#e0a030', other: '#a78bdb' })
    expect(p.dim).toBe('#2a2e38')
    expect(p.ring).toBe('#ffffff')
    expect(p.accent).toBe('#5b8def')
    expect(p.canvasBg).toBe('#0f1117')
    expect(p.ghost).toBe(0.15)
  })
  it('colorblind palette swaps running/blocked to blue/orange', () => {
    const p = makePalette('dark', true)
    expect(p.state.running).toBe('#0072b2')
    expect(p.state.blocked).toBe('#d55e00')
    expect(p.state.runnable).toBe('#9aa3b2')
  })
  it('light theme swaps dim/ring/background/text', () => {
    const p = makePalette('light', false)
    expect(p.dim).toBe('#d4d8e0')
    expect(p.ring).toBe('#12161f')
    expect(p.canvasBg).toBe('#f5f6f8')
    expect(p.text).toBe('#333a4a')
    expect(p.accent).toBe('#3e6fd9')
  })
})

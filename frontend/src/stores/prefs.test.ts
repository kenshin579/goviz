import { describe, it, expect } from 'vitest'
import { get } from 'svelte/store'
import { createPrefsStore } from './prefs'
import { KEYS } from '../lib/prefs'

function fakeStorage(init: Record<string, string> = {}) {
  const m = new Map(Object.entries(init))
  return {
    getItem: (k: string) => (m.has(k) ? m.get(k)! : null),
    setItem: (k: string, v: string) => void m.set(k, v),
    removeItem: (k: string) => void m.delete(k),
    dump: () => Object.fromEntries(m),
  }
}

describe('createPrefsStore', () => {
  it('initializes from storage and persists on set', () => {
    const s = fakeStorage({ [KEYS.theme]: 'light' })
    const p = createPrefsStore(s, 'ko-KR')
    expect(get(p.theme)).toBe('light')
    expect(get(p.lang)).toBe('ko')
    p.loop.set(true)
    p.lang.set('en')
    expect(s.dump()[KEYS.loop]).toBe('true')
    expect(s.dump()[KEYS.lang]).toBe('en')
  })
  it('derives dict and palette from lang/theme/cb', () => {
    const p = createPrefsStore(fakeStorage(), 'en-US')
    expect(get(p.dict).speed).toBe('Speed')
    expect(get(p.palette).state.running).toBe('#4caf50')
    p.lang.set('ko')
    p.cb.set(true)
    expect(get(p.dict).speed).toBe('속도')
    expect(get(p.palette).state.running).toBe('#0072b2')
    p.theme.set('light')
    expect(get(p.palette).canvasBg).toBe('#f5f6f8')
  })
  it('persists labels=true then removes the key when set back to null', () => {
    const s = fakeStorage()
    const p = createPrefsStore(s, 'en-US')
    p.labels.set(true)
    expect(s.dump()[KEYS.labels]).toBe('true')
    p.labels.set(null)
    expect(s.dump()).not.toHaveProperty(KEYS.labels)
  })
  it('works with null storage (no persistence, defaults only)', () => {
    const p = createPrefsStore(null, undefined)
    expect(get(p.lang)).toBe('en')
    p.onboarded.set(true) // must not throw
    expect(get(p.onboarded)).toBe(true)
  })
})

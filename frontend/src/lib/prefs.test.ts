import { describe, it, expect } from 'vitest'
import { detectLang, loadPrefs, savePref, effectiveLabels, KEYS } from './prefs'

function fakeStorage(init: Record<string, string> = {}) {
  const m = new Map(Object.entries(init))
  return {
    getItem: (k: string) => (m.has(k) ? m.get(k)! : null),
    setItem: (k: string, v: string) => void m.set(k, v),
    removeItem: (k: string) => void m.delete(k),
    dump: () => Object.fromEntries(m),
  }
}

describe('detectLang', () => {
  it('maps ko locales to ko and everything else to en', () => {
    expect(detectLang('ko')).toBe('ko')
    expect(detectLang('ko-KR')).toBe('ko')
    expect(detectLang('en-US')).toBe('en')
    expect(detectLang(undefined)).toBe('en')
  })
})

describe('loadPrefs', () => {
  it('returns defaults from an empty storage (lang via locale)', () => {
    const p = loadPrefs(fakeStorage(), 'ko-KR')
    expect(p).toEqual({
      lang: 'ko', theme: 'dark', guide: 'tour',
      loop: false, labels: null, cb: false, sys: false, onboarded: false,
    })
  })
  it('reads stored values and validates enums', () => {
    const p = loadPrefs(
      fakeStorage({
        [KEYS.lang]: 'en', [KEYS.theme]: 'light', [KEYS.guide]: 'callouts',
        [KEYS.loop]: 'true', [KEYS.labels]: 'false', [KEYS.cb]: 'true',
        [KEYS.sys]: 'true', [KEYS.onboarded]: 'true',
      }),
      'ko',
    )
    expect(p).toEqual({
      lang: 'en', theme: 'light', guide: 'callouts',
      loop: true, labels: false, cb: true, sys: true, onboarded: true,
    })
  })
  it('falls back to defaults on garbage enum values and null storage', () => {
    const p = loadPrefs(fakeStorage({ [KEYS.theme]: 'neon', [KEYS.guide]: 'xxl' }), 'en')
    expect(p.theme).toBe('dark')
    expect(p.guide).toBe('tour')
    expect(loadPrefs(null, 'en').lang).toBe('en')
  })
})

describe('savePref', () => {
  it('stringifies values under the given key and removes the key on null', () => {
    const s = fakeStorage({ [KEYS.labels]: 'true' })
    savePref(s, KEYS.loop, true)
    savePref(s, KEYS.lang, 'ko')
    savePref(s, KEYS.labels, null)
    expect(s.dump()).toEqual({ [KEYS.loop]: 'true', [KEYS.lang]: 'ko' })
  })
})

describe('effectiveLabels', () => {
  it('defers null to the guide style (inline shows labels)', () => {
    expect(effectiveLabels(null, 'inline')).toBe(true)
    expect(effectiveLabels(null, 'tour')).toBe(false)
    expect(effectiveLabels(true, 'tour')).toBe(true)
    expect(effectiveLabels(false, 'inline')).toBe(false)
  })
})

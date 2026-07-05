import { describe, it, expect } from 'vitest'
import { t, withColorWords } from './i18n'

describe('t', () => {
  it('returns the dictionary for each language', () => {
    expect(t('en').speed).toBe('Speed')
    expect(t('ko').speed).toBe('속도')
  })
  it('en and ko dictionaries have identical key sets (recursively)', () => {
    const keysOf = (o: unknown, prefix = ''): string[] =>
      o !== null && typeof o === 'object' && !Array.isArray(o)
        ? Object.entries(o as Record<string, unknown>).flatMap(([k, v]) =>
            typeof v === 'function' ? [prefix + k] : keysOf(v, prefix + k + '.'),
          )
        : [prefix.slice(0, -1)]
    expect(keysOf(t('ko')).sort()).toEqual(keysOf(t('en')).sort())
  })
  it('both languages ship 4 tour steps', () => {
    expect(t('en').tour).toHaveLength(4)
    expect(t('ko').tour).toHaveLength(4)
  })
  it('info interpolates counts and duration', () => {
    expect(t('en').info(8, 10, '100.0')).toBe('8 goroutines · 10 edges · 100.0 ms')
    expect(t('ko').info(8, 10, '100.0')).toBe('고루틴 8 · 엣지 10 · 100.0 ms')
  })
})

describe('withColorWords', () => {
  it('substitutes {run}/{blk} using the standard color words', () => {
    expect(withColorWords('{run} running, {blk} blocked', t('en'), false)).toBe('green running, red blocked')
    expect(withColorWords('{run} 실행, {blk} 차단', t('ko'), false)).toBe('초록 실행, 빨강 차단')
  })
  it('uses colorblind words when cb is on', () => {
    expect(withColorWords('{run}/{blk}', t('en'), true)).toBe('blue/orange')
  })
})

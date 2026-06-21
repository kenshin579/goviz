import { describe, it, expect } from 'vitest'
import { groupGoroutines } from './grouping'
import type { Goroutine } from './types'

function g(id: number, name: string): Goroutine {
  return { id, name, createdAt: 0, endedAt: 0, intervals: [] }
}

describe('groupGoroutines', () => {
  it('groups goroutines that share a non-empty start function (>=2)', () => {
    const groups = groupGoroutines([g(1, 'main.worker'), g(2, 'main.worker'), g(3, 'main.worker')])
    expect(groups).toHaveLength(1)
    expect(groups[0].key).toBe('main.worker')
    expect(groups[0].name).toBe('main.worker')
    expect(groups[0].members.map((m) => m.id)).toEqual([1, 2, 3])
  })

  it('keeps a unique-named goroutine as a solo group (1 member)', () => {
    const groups = groupGoroutines([g(1, 'main.a'), g(2, 'main.b')])
    expect(groups).toHaveLength(2)
    expect(groups.every((gr) => gr.members.length === 1)).toBe(true)
  })

  it('mixes a shared group and solo goroutines, preserving first-appearance order', () => {
    const groups = groupGoroutines([g(1, 'main.solo'), g(2, 'main.w'), g(3, 'main.w')])
    expect(groups.map((gr) => gr.key)).toEqual(['main.solo', 'main.w'])
    expect(groups[1].members.map((m) => m.id)).toEqual([2, 3])
  })

  it('never groups empty-name goroutines together (each is solo with a unique key)', () => {
    const groups = groupGoroutines([g(1, ''), g(2, '')])
    expect(groups).toHaveLength(2)
    expect(groups[0].members).toHaveLength(1)
    expect(groups[1].members).toHaveLength(1)
    expect(groups[0].key).not.toBe(groups[1].key)
  })
})

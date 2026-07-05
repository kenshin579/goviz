import { describe, it, expect } from 'vitest'
import { intervalTooltip, nodeTooltip, edgeTooltip } from './tooltip'
import { t } from './i18n'
const EN = t('en')
const KO = t('ko')

describe('intervalTooltip', () => {
  it('shows label + localized state, appending the block reason when present', () => {
    expect(intervalTooltip('worker', 'blocked', 'chan receive', EN)).toBe('worker\nblocked · chan receive')
    expect(intervalTooltip('worker', 'running', '', EN)).toBe('worker\nrunning')
    expect(intervalTooltip('worker', 'blocked', 'chan receive', KO)).toBe('worker\n차단됨 · chan receive')
  })
})

describe('nodeTooltip', () => {
  it('falls back to the localized not-alive text', () => {
    expect(nodeTooltip('g7', null, EN)).toBe('g7\nnot alive')
    expect(nodeTooltip('g7', 'running', KO)).toBe('g7\n실행 중')
  })
})

describe('edgeTooltip', () => {
  it('labels the category and marks it inferred, localized', () => {
    expect(edgeTooltip('channel', 'producer', 'consumer', EN)).toBe('producer → consumer\nchannel (inferred)')
    expect(edgeTooltip('mutex', 'a', 'b', KO)).toBe('a → b\n뮤텍스 (추정)')
  })
})

import { regionTooltip, logTooltip, taskTooltip } from './tooltip'

describe('regionTooltip', () => {
  it('shows the region name and its duration in ms', () => {
    expect(regionTooltip('db-query', 1_000_000, 4_000_000)).toBe('db-query\n3.000 ms')
  })
})

describe('logTooltip', () => {
  it('shows category then message', () => {
    expect(logTooltip('cache', 'miss')).toBe('cache\nmiss')
  })
})

describe('taskTooltip', () => {
  it('shows the task name and duration in ms', () => {
    expect(taskTooltip('request', 0, 2_000_000)).toBe('request\n2.000 ms')
  })
})

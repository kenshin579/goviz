import type { IntervalState } from './format'
import type { EdgeCategory } from './types'

// intervalTooltip describes a hovered timeline interval. The block reason is
// only meaningful (and shown) for blocked intervals that carry one.
export function intervalTooltip(label: string, state: IntervalState, blockReason: string): string {
  const detail = state === 'blocked' && blockReason ? `${state} · ${blockReason}` : state
  return `${label}\n${detail}`
}

// nodeTooltip describes a hovered graph node at the current playhead time.
export function nodeTooltip(label: string, state: IntervalState | null): string {
  return `${label}\n${state ?? 'not running at this time'}`
}

// edgeTooltip describes a hovered causal edge. The trace exposes no channel
// identity or transferred value, so every relation is labelled "(inferred)".
export function edgeTooltip(category: EdgeCategory, fromLabel: string, toLabel: string): string {
  const kind =
    category === 'channel'
      ? 'channel communication'
      : category === 'mutex'
        ? 'mutex synchronization'
        : 'unblock'
  return `${fromLabel} → ${toLabel}\n${kind} (inferred)`
}

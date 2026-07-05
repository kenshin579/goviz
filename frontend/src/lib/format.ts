// Pure display helpers shared by the layout and the canvas renderer.

export function goroutineLabel(g: { id: number; name: string }): string {
  return g.name !== '' ? g.name : `g${g.id}`
}

// effectiveEnd resolves the 0 "never ended" sentinel to the trace end time.
export function effectiveEnd(g: { endedAt: number }, traceEnd: number): number {
  return g.endedAt === 0 ? traceEnd : g.endedAt
}

export type IntervalState = 'running' | 'runnable' | 'blocked'

import type { EdgeCategory } from './types'
import { makePalette } from './palette'

// Default palette (dark theme, standard colors). Theme-aware rendering paths
// get a live palette from stores/prefs.ts instead; these exports remain as the
// single fallback so pure layout code and tests need no theme plumbing.
const DEFAULT_PALETTE = makePalette('dark', false)

// stateColor returns a fill for a known state, or a neutral gray for anything
// unexpected (defensive against future trace states).
export function stateColor(state: IntervalState): string {
  return DEFAULT_PALETTE.state[state] ?? '#5b6270'
}

export const DIM_COLOR = DEFAULT_PALETTE.dim // node not alive / inactive edge
export const EDGE_ACTIVE_COLOR = DEFAULT_PALETTE.category.channel // edge firing near the playhead

// Per-category edge/comet colors. These encode the inferred synchronization
// kind, NOT a transferred value (the trace has no channel identity).
export const CATEGORY_COLORS: Record<EdgeCategory, string> = DEFAULT_PALETTE.category

export function categoryColor(category: EdgeCategory): string {
  return CATEGORY_COLORS[category] ?? CATEGORY_COLORS.channel
}

// Distinct task colors, indexed by task id (stable across redraws).
const TASK_PALETTE = ['#7a6bb0', '#5b8def', '#3a8a63', '#c08457', '#b05a8a', '#4aa3a3']

export function taskColor(id: number): string {
  return TASK_PALETTE[id % TASK_PALETTE.length]
}

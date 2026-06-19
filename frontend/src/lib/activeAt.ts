import type { Goroutine, CausalEdge } from './types'
import type { IntervalState } from './format'

// stateAt returns the goroutine's state at time t — the state of the interval
// [start, end) containing t — or null if t falls outside all of its intervals
// (before it ran / after it ended). Intervals are start-inclusive, end-exclusive.
export function stateAt(g: Goroutine, t: number): IntervalState | null {
  for (const iv of g.intervals) {
    if (t >= iv.start && t < iv.end) return iv.state
  }
  return null
}

// activeEdges returns the causal edges whose firing time is within +/- windowNs
// of t — i.e. the unblocks "happening" around the current playhead.
export function activeEdges(edges: CausalEdge[], t: number, windowNs: number): CausalEdge[] {
  return edges.filter((e) => Math.abs(e.time - t) <= windowNs)
}

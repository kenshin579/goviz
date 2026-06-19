// Pure display helpers shared by the layout and the canvas renderer.

export function goroutineLabel(g: { id: number; name: string }): string {
  return g.name !== '' ? g.name : `g${g.id}`
}

// effectiveEnd resolves the 0 "never ended" sentinel to the trace end time.
export function effectiveEnd(g: { endedAt: number }, traceEnd: number): number {
  return g.endedAt === 0 ? traceEnd : g.endedAt
}

export type IntervalState = 'running' | 'runnable' | 'blocked'

const STATE_COLORS: Record<IntervalState, string> = {
  running: '#4caf50',
  runnable: '#9aa3b2',
  blocked: '#c25450',
}

// stateColor returns a fill for a known state, or a neutral gray for anything
// unexpected (defensive against future trace states).
export function stateColor(state: IntervalState): string {
  return STATE_COLORS[state] ?? '#5b6270'
}

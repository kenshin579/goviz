// Frontend mirror of the Go model.TraceSummary JSON contract (internal/model).
// Kept hand-written and minimal so lib/ has no dependency on generated wailsjs.
import type { IntervalState } from './format'

export interface Interval {
  start: number
  end: number
  state: IntervalState
  blockReason?: string
}

export interface Region {
  start: number
  end: number
  name: string
  depth: number
  task?: number
}

export interface Log {
  time: number
  goId: number
  category: string
  message: string
  task?: number
}

export interface Task {
  id: number
  parent: number
  name: string
  start: number
  end: number
}

export interface Goroutine {
  id: number
  name: string
  createdAt: number
  endedAt: number
  intervals: Interval[]
  regions?: Region[]
}

export type EdgeCategory = 'channel' | 'mutex' | 'other'

export interface CausalEdge {
  from: number
  to: number
  time: number
  category: EdgeCategory
}

export interface TraceSummary {
  startTime: number
  endTime: number
  goroutines: Goroutine[]
  edges: CausalEdge[]
  logs?: Log[]
  tasks?: Task[]
}

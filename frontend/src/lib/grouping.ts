import type { Goroutine } from './types'

export interface GoroutineGroup {
  key: string // group identifier = shared start-function name; empty-name goroutines get a unique solo key
  name: string // display name
  members: Goroutine[] // 1 = solo (no header); 2+ = a real group (header)
}

// groupGoroutines buckets goroutines that share a non-empty start function (name)
// into one group, preserving first-appearance order; their members keep input
// order. A goroutine with an empty name, or a name shared by no one else, becomes
// a solo group (members.length === 1). Empty-name goroutines never merge: each
// gets a unique key so they stay separate solo rows.
export function groupGoroutines(goroutines: Goroutine[]): GoroutineGroup[] {
  const order: string[] = []
  const byKey = new Map<string, GoroutineGroup>()
  for (const g of goroutines) {
    // Empty-name goroutines must not merge: give each a unique key.
    const key = g.name === '' ? `g${g.id}` : g.name
    let group = byKey.get(key)
    if (!group) {
      group = { key, name: g.name, members: [] }
      byKey.set(key, group)
      order.push(key)
    }
    group.members.push(g)
  }
  return order.map((k) => byKey.get(k)!)
}

# trace-go Plan 2C — Live Goroutine Graph + Timeline Sync

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the hybrid view's second half — a live, force-directed **goroutine graph** below the timeline. Nodes are goroutines colored by their state *at the current playhead time*; edges are inferred causal (channel/mutex) relationships, emphasized when they fire near the playhead. The graph shares the existing playhead, so scrubbing and playback animate it for free. Clicking a node highlights that goroutine in both views.

**Architecture:** Pure, unit-tested TS computes everything the graph *shows*: `stateAt(goroutine, t)` (state at a time), `activeEdges(edges, t, window)` (edges firing near t), and `buildGraphModel(goroutines, edges)` (the persistent node/link sets). A new `GraphCanvas.svelte` runs a `d3-force` simulation **once per node-set change** to lay out node positions, then on every `$playhead` change merely *recolors* nodes and re-emphasizes active edges — it never re-simulates on time change, so the layout stays stable and jitter-free. A `selectedId` store ties the two canvases together for click-highlight. The timeline's dangling-playhead cosmetic is fixed.

**Tech Stack:** Svelte 3 + TypeScript + Vite, Vitest, HTML Canvas 2D, **`d3-force` v3** (new dependency) for layout only (we render to canvas ourselves).

**Scope note:** This is Plan 2C of the `trace-go` v1 spec (`docs/superpowers/specs/2026-06-19-concurrency-visualizer-design.md`) — it completes the **hybrid visualization** (spec §4: live graph view, timeline↔graph sync, goroutine click cross-highlight) that 2A (timeline) and 2B (playback + filter) set up. Plans 1, 2A, 2B are merged on `main`. Out of scope (a possible Plan 2D polish): edge "flash" tween animation, large-trace (1000s of nodes) performance/WebGL, graph zoom/pan.

**Current state (verified):** `stores/trace.ts` exposes `summary`/`playhead`/`playing`/`speed`/`showSystem` + actions. `lib/` has `timeMap`, `format`, `timelineLayout`, `filter`, `playback`, `types`. `components/TimelineCanvas.svelte` renders `visibleGoroutines($summary,$showSystem)` and redraws on `$playhead`; its playhead is drawn `lineTo(x, cssHeight)` (the dangling line to fix). `App.svelte` has a `header` (Open + Controls) and one `.timeline` section. 30 vitest tests pass.

---

## File Structure

- `frontend/src/lib/activeAt.ts` — pure `stateAt(goroutine, t)` + `activeEdges(edges, t, windowNs)`. Test: `activeAt.test.ts`.
- `frontend/src/lib/graphModel.ts` — pure `buildGraphModel(goroutines, edges)` → `{nodes, links}`. Test: `graphModel.test.ts`.
- `frontend/src/stores/trace.ts` — **modify**: add `selectedId: Writable<number|null>` + `setSelected(id|null)`/`toggleSelected(id)`. Test: extend `trace.test.ts`.
- `frontend/src/components/GraphCanvas.svelte` — **new**: d3-force layout + canvas render (state-colored nodes, active-edge emphasis, click-to-select). (Visual; manual-verified.)
- `frontend/src/components/TimelineCanvas.svelte` — **modify**: highlight the selected lane; fix the dangling playhead line. (Visual; manual-verified.)
- `frontend/src/App.svelte` — **modify**: split layout — timeline (top) + graph (bottom). (Visual; manual-verified.)
- `frontend/package.json` — **modify**: add `d3-force` + `@types/d3-force`.

**Pure-logic-first:** `stateAt`/`activeEdges`/`buildGraphModel` and the `selectedId` store are TDD'd; only the d3-force simulation, canvas drawing, and the three Svelte view edits are manual-verified.

---

## Task 1: Pure "state at time t" + active edges

**Files:** Create `frontend/src/lib/activeAt.ts`; Test `frontend/src/lib/activeAt.test.ts`.

- [ ] **Step 1: Write the failing test**

Create `frontend/src/lib/activeAt.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { stateAt, activeEdges } from './activeAt'
import type { Goroutine, CausalEdge } from './types'

const g: Goroutine = {
  id: 1,
  name: 'a',
  createdAt: 0,
  endedAt: 100,
  intervals: [
    { start: 0, end: 40, state: 'running', blockReason: '' },
    { start: 40, end: 100, state: 'blocked', blockReason: 'chan receive' },
  ],
}

describe('stateAt', () => {
  it('returns the state of the interval containing t', () => {
    expect(stateAt(g, 10)).toBe('running')
    expect(stateAt(g, 40)).toBe('blocked') // start-inclusive
    expect(stateAt(g, 99)).toBe('blocked')
  })
  it('returns null when t is outside every interval', () => {
    expect(stateAt(g, -1)).toBeNull()
    expect(stateAt(g, 100)).toBeNull() // end-exclusive
  })
})

describe('activeEdges', () => {
  const edges: CausalEdge[] = [
    { from: 1, to: 2, time: 50, category: 'channel' },
    { from: 2, to: 3, time: 80, category: 'mutex' },
    { from: 3, to: 1, time: 200, category: 'other' },
  ]
  it('returns edges whose time is within +/- window of t', () => {
    const a = activeEdges(edges, 55, 10) // window 10 -> [45,65]
    expect(a.map((e) => e.time)).toEqual([50])
  })
  it('includes multiple edges in range and excludes out-of-range', () => {
    const a = activeEdges(edges, 65, 20) // [45,85] -> 50 and 80
    expect(a.map((e) => e.time)).toEqual([50, 80])
  })
  it('returns empty when none are in range', () => {
    expect(activeEdges(edges, 130, 5)).toEqual([])
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run:
```bash
cd /Users/user/GolandProjects/trace-go/frontend
npm test -- activeAt
```
Expected: FAIL — cannot find `./activeAt`.

- [ ] **Step 3: Write the implementation**

Create `frontend/src/lib/activeAt.ts`:
```ts
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
```

- [ ] **Step 4: Run test to verify it passes**

Run:
```bash
cd /Users/user/GolandProjects/trace-go/frontend
npm test -- activeAt
```
Expected: all tests PASS.

- [ ] **Step 5: Commit**

```bash
cd /Users/user/GolandProjects/trace-go
git add frontend/src/lib/activeAt.ts frontend/src/lib/activeAt.test.ts
git commit -m "feat(frontend): add stateAt + activeEdges time-slice helpers"
```

---

## Task 2: Pure graph model builder

Builds the persistent node/link sets for the force layout from the *visible* goroutines and edges. Links are deduped per goroutine pair (multiple unblocks between the same two goroutines collapse to one layout link); edges touching a hidden goroutine are dropped.

**Files:** Create `frontend/src/lib/graphModel.ts`; Test `frontend/src/lib/graphModel.test.ts`.

- [ ] **Step 1: Write the failing test**

Create `frontend/src/lib/graphModel.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { buildGraphModel } from './graphModel'
import type { Goroutine, CausalEdge } from './types'

const goroutines: Goroutine[] = [
  { id: 1, name: 'main.a', createdAt: 0, endedAt: 100, intervals: [] },
  { id: 2, name: '', createdAt: 0, endedAt: 100, intervals: [] },
]
const edges: CausalEdge[] = [
  { from: 1, to: 2, time: 10, category: 'channel' },
  { from: 1, to: 2, time: 20, category: 'channel' }, // duplicate pair
  { from: 2, to: 9, time: 30, category: 'mutex' }, // 9 not in visible set -> dropped
]

describe('buildGraphModel', () => {
  it('makes one node per goroutine with a display label', () => {
    const m = buildGraphModel(goroutines, edges)
    expect(m.nodes.map((n) => n.id)).toEqual([1, 2])
    expect(m.nodes[0].label).toBe('main.a')
    expect(m.nodes[1].label).toBe('g2') // empty name fallback
  })

  it('dedups links per pair and drops links to hidden goroutines', () => {
    const m = buildGraphModel(goroutines, edges)
    expect(m.links).toHaveLength(1)
    expect(m.links[0]).toMatchObject({ source: 1, target: 2, category: 'channel' })
  })

  it('handles an empty goroutine set', () => {
    const m = buildGraphModel([], edges)
    expect(m.nodes).toEqual([])
    expect(m.links).toEqual([])
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run:
```bash
cd /Users/user/GolandProjects/trace-go/frontend
npm test -- graphModel
```
Expected: FAIL — cannot find `./graphModel`.

- [ ] **Step 3: Write the implementation**

Create `frontend/src/lib/graphModel.ts`:
```ts
import type { Goroutine, CausalEdge, EdgeCategory } from './types'
import { goroutineLabel } from './format'

// GraphNode is a persistent node object. d3-force mutates x/y/vx/vy in place
// during simulation; we keep these optional and let the sim populate them.
export interface GraphNode {
  id: number
  label: string
  x?: number
  y?: number
  vx?: number
  vy?: number
}

export interface GraphLink {
  source: number
  target: number
  category: EdgeCategory
}

export interface GraphModel {
  nodes: GraphNode[]
  links: GraphLink[]
}

// buildGraphModel produces the persistent node/link sets for the force layout
// from the currently visible goroutines. Links are deduped per (from,to) pair
// and any edge referencing a goroutine outside the visible set is dropped.
export function buildGraphModel(goroutines: Goroutine[], edges: CausalEdge[]): GraphModel {
  const nodes: GraphNode[] = goroutines.map((g) => ({ id: g.id, label: goroutineLabel(g) }))
  const ids = new Set(nodes.map((n) => n.id))

  const seen = new Set<string>()
  const links: GraphLink[] = []
  for (const e of edges) {
    if (!ids.has(e.from) || !ids.has(e.to)) continue
    const key = `${e.from}->${e.to}`
    if (seen.has(key)) continue
    seen.add(key)
    links.push({ source: e.from, target: e.to, category: e.category })
  }
  return { nodes, links }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run:
```bash
cd /Users/user/GolandProjects/trace-go/frontend
npm test -- graphModel
```
Expected: all tests PASS.

- [ ] **Step 5: Commit**

```bash
cd /Users/user/GolandProjects/trace-go
git add frontend/src/lib/graphModel.ts frontend/src/lib/graphModel.test.ts
git commit -m "feat(frontend): add pure graph model builder"
```

---

## Task 3: Selected-goroutine store

**Files:** Modify `frontend/src/stores/trace.ts`; Test: extend `frontend/src/stores/trace.test.ts`.

- [ ] **Step 1: Write the failing tests (append to existing file)**

Append to `frontend/src/stores/trace.test.ts`:
```ts
describe('createTraceStore selection', () => {
  it('defaults to no selection', () => {
    const s = createTraceStore()
    expect(get(s.selectedId)).toBeNull()
  })
  it('setSelected sets and clears the selection', () => {
    const s = createTraceStore()
    s.setSelected(7)
    expect(get(s.selectedId)).toBe(7)
    s.setSelected(null)
    expect(get(s.selectedId)).toBeNull()
  })
  it('toggleSelected toggles the same id off and switches to a new one', () => {
    const s = createTraceStore()
    s.toggleSelected(7)
    expect(get(s.selectedId)).toBe(7)
    s.toggleSelected(7) // same -> clear
    expect(get(s.selectedId)).toBeNull()
    s.toggleSelected(7)
    s.toggleSelected(9) // different -> switch
    expect(get(s.selectedId)).toBe(9)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run:
```bash
cd /Users/user/GolandProjects/trace-go/frontend
npm test -- stores/trace
```
Expected: FAIL — `s.selectedId`/`s.setSelected`/`s.toggleSelected` undefined.

- [ ] **Step 3: Add selection to the store**

In `frontend/src/stores/trace.ts`, make these three edits:

(a) Add to the `TraceStore` interface (after `showSystem: Writable<boolean>`):
```ts
  selectedId: Writable<number | null>
```
and (after `setShowSystem(v: boolean): void`):
```ts
  setSelected(id: number | null): void
  toggleSelected(id: number): void
```

(b) Create the writable (next to the other `writable(...)` declarations):
```ts
  const selectedId = writable<number | null>(null)
```

(c) Expose it and the actions on the returned `api` object — add `selectedId,` to the property list, and add these methods:
```ts
    setSelected(id) {
      selectedId.set(id)
    },
    toggleSelected(id) {
      selectedId.update((cur) => (cur === id ? null : id))
    },
```

- [ ] **Step 4: Run tests to verify they pass**

Run:
```bash
cd /Users/user/GolandProjects/trace-go/frontend
npm test -- stores/trace
```
Expected: all store tests PASS (previous + 3 new selection tests).

- [ ] **Step 5: Commit**

```bash
cd /Users/user/GolandProjects/trace-go
git add frontend/src/stores/trace.ts frontend/src/stores/trace.test.ts
git commit -m "feat(frontend): add selected-goroutine state to trace store"
```

---

## Task 4: Add d3-force dependency

**Files:** Modify `frontend/package.json` (+ lockfile).

- [ ] **Step 1: Install d3-force and its types**

Run:
```bash
cd /Users/user/GolandProjects/trace-go/frontend
npm install d3-force@^3.0.0
npm install -D @types/d3-force@^3.0.0
```
Expected: `d3-force` in `dependencies`, `@types/d3-force` in `devDependencies`.

- [ ] **Step 2: Verify the suite + type-check still pass**

Run:
```bash
cd /Users/user/GolandProjects/trace-go/frontend
npm test && npm run check
```
Expected: all unit suites pass; `svelte-check` 0 errors.

- [ ] **Step 3: Commit**

```bash
cd /Users/user/GolandProjects/trace-go
git add frontend/package.json frontend/package-lock.json
git commit -m "chore(frontend): add d3-force for graph layout"
```

---

## Task 5: GraphCanvas component (manual-verified)

Lays out nodes with d3-force **once per node-set change**, then redraws (recolor + active-edge emphasis) on every `$playhead`/`$selectedId` change without re-simulating.

**Files:** Create `frontend/src/components/GraphCanvas.svelte`.

- [ ] **Step 1: Write the component**

Create `frontend/src/components/GraphCanvas.svelte`:
```svelte
<script lang="ts">
  import { onMount, onDestroy } from 'svelte'
  import {
    forceSimulation,
    forceManyBody,
    forceLink,
    forceCenter,
    forceCollide,
    type Simulation,
  } from 'd3-force'
  import { traceStore } from '../stores/trace'
  import { visibleGoroutines } from '../lib/filter'
  import { buildGraphModel, type GraphNode, type GraphLink } from '../lib/graphModel'
  import { stateAt, activeEdges } from '../lib/activeAt'
  import { stateColor } from '../lib/format'
  import type { Goroutine, CausalEdge } from '../lib/types'

  const { summary, playhead, showSystem, selectedId } = traceStore

  let container: HTMLDivElement
  let canvas: HTMLCanvasElement
  let cssWidth = 600
  let cssHeight = 360

  let nodes: GraphNode[] = []
  let links: GraphLink[] = []
  let goroutineById = new Map<number, Goroutine>()
  let sim: Simulation<GraphNode, GraphLink> | undefined

  // Rebuild the graph + simulation ONLY when the visible node set changes
  // (summary or filter) — never on playhead, so the layout stays stable.
  $: rebuild($summary ? visibleGoroutines($summary, $showSystem) : [], $summary?.edges ?? [])

  function rebuild(goroutines: Goroutine[], edges: CausalEdge[]) {
    goroutineById = new Map(goroutines.map((g) => [g.id, g]))
    const model = buildGraphModel(goroutines, edges)
    nodes = model.nodes
    links = model.links
    sim?.stop()
    if (nodes.length === 0) {
      draw()
      return
    }
    sim = forceSimulation<GraphNode>(nodes)
      .force('charge', forceManyBody().strength(-120))
      .force('link', forceLink<GraphNode, GraphLink>(links).id((d) => d.id).distance(60))
      .force('center', forceCenter(cssWidth / 2, cssHeight / 2))
      .force('collide', forceCollide(16))
      .on('tick', draw)
  }

  // Redraw (recolor + active-edge emphasis) on time/selection change. Does NOT
  // touch the simulation, so node positions are preserved.
  $: void [$playhead, $selectedId], draw()

  function draw() {
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const dpr = window.devicePixelRatio || 1
    canvas.width = Math.round(cssWidth * dpr)
    canvas.height = Math.round(cssHeight * dpr)
    canvas.style.height = cssHeight + 'px'
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.fillStyle = '#0f1117'
    ctx.fillRect(0, 0, cssWidth, cssHeight)

    const t = $playhead
    const span = $summary ? $summary.endTime - $summary.startTime : 0
    const win = span * 0.03
    const active = $summary ? new Set(activeEdges($summary.edges, t, win).map((e) => `${e.from}->${e.to}`)) : new Set<string>()

    // Edges first (under nodes).
    for (const l of links) {
      const s = l.source as unknown as GraphNode
      const tg = l.target as unknown as GraphNode
      if (s.x == null || tg.x == null) continue
      const isActive = active.has(`${s.id}->${tg.id}`)
      ctx.strokeStyle = isActive ? '#5b8def' : '#2a2e38'
      ctx.lineWidth = isActive ? 2.5 : 1
      ctx.beginPath()
      ctx.moveTo(s.x, s.y!)
      ctx.lineTo(tg.x, tg.y!)
      ctx.stroke()
    }

    // Nodes.
    for (const n of nodes) {
      if (n.x == null) continue
      const g = goroutineById.get(n.id)
      const st = g ? stateAt(g, t) : null
      ctx.fillStyle = st ? stateColor(st) : '#2a2e38' // dim if not alive at t
      ctx.beginPath()
      ctx.arc(n.x, n.y!, 9, 0, Math.PI * 2)
      ctx.fill()
      if (n.id === $selectedId) {
        ctx.strokeStyle = '#ffffff'
        ctx.lineWidth = 2
        ctx.stroke()
      }
    }
  }

  function nodeAt(px: number, py: number): GraphNode | undefined {
    return nodes.find((n) => n.x != null && Math.hypot(n.x - px, n.y! - py) <= 10)
  }
  function onClick(e: MouseEvent) {
    const rect = canvas.getBoundingClientRect()
    const n = nodeAt(e.clientX - rect.left, e.clientY - rect.top)
    if (n) traceStore.toggleSelected(n.id)
  }

  onMount(() => {
    const measure = () => {
      cssWidth = container.clientWidth || cssWidth
      cssHeight = container.clientHeight || cssHeight
      sim?.force('center', forceCenter(cssWidth / 2, cssHeight / 2))
      sim?.alpha(0.3).restart()
    }
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(container)
    draw()
    return () => ro.disconnect()
  })
  onDestroy(() => sim?.stop())
</script>

<div bind:this={container} class="graph-wrap">
  <canvas bind:this={canvas} on:click={onClick} style="width:100%; display:block; cursor:pointer;"></canvas>
</div>

<style>
  .graph-wrap { width: 100%; height: 100%; min-height: 280px; }
</style>
```

- [ ] **Step 2: Type-check**

Run:
```bash
cd /Users/user/GolandProjects/trace-go/frontend
npm run check
```
Expected: 0 errors (a11y hints acceptable). Note: after `forceLink(...).id(...)`, d3 mutates `link.source`/`link.target` from numbers into `GraphNode` refs in place — the draw code reads `.x`/`.y` off them via the `as unknown as GraphNode` casts, which is why those casts are present and correct.

- [ ] **Step 3: Commit**

```bash
cd /Users/user/GolandProjects/trace-go
git add frontend/src/components/GraphCanvas.svelte
git commit -m "feat(frontend): add live force-directed goroutine graph"
```

---

## Task 6: Split layout + timeline selection highlight + playhead fix (manual-verified)

**Files:** Modify `frontend/src/App.svelte`, `frontend/src/components/TimelineCanvas.svelte`.

- [ ] **Step 1: Render the graph below the timeline in App.svelte**

In `frontend/src/App.svelte`, add the import:
```svelte
  import GraphCanvas from './components/GraphCanvas.svelte'
```
Replace the single timeline section:
```svelte
  {#if $summary}
    <section class="timeline"><TimelineCanvas /></section>
  {:else}
    <section class="empty">Open a Go execution trace (.out) to begin.</section>
  {/if}
```
with a split layout:
```svelte
  {#if $summary}
    <section class="timeline"><TimelineCanvas /></section>
    <section class="graph"><GraphCanvas /></section>
  {:else}
    <section class="empty">Open a Go execution trace (.out) to begin.</section>
  {/if}
```
And update the `<style>` — replace the `.timeline { flex: 1; overflow: auto; }` rule with:
```css
  .timeline { flex: 0 0 42%; overflow: auto; border-bottom: 1px solid #2a2e38; }
  .graph { flex: 1; min-height: 0; }
```

- [ ] **Step 2: Highlight the selected lane + fix the dangling playhead in TimelineCanvas**

In `frontend/src/components/TimelineCanvas.svelte`:

(a) Add `selectedId` to the destructured store:
```svelte
  const { summary, playhead, showSystem, selectedId } = traceStore
```

(b) Add `$selectedId` to the redraw dependency list — change:
```svelte
  $: void [$playhead, lanes, cssWidth, cssHeight], draw()
```
to:
```svelte
  $: void [$playhead, lanes, cssWidth, cssHeight, $selectedId], draw()
```

(c) In `draw()`, replace the playhead block (the `if ($summary) { ... }` that draws the line) with a version that (1) clamps the line to the lanes' bottom and (2) outlines the selected lane:
```svelte
    const lanesBottom = lanes.length * (LANE_H + LANE_GAP)

    // Highlight the selected goroutine's lane.
    for (const lane of lanes) {
      if (lane.goroutineId === $selectedId) {
        ctx.strokeStyle = '#ffffff'
        ctx.lineWidth = 1.5
        ctx.strokeRect(0.5, lane.y + 0.5, cssWidth - 1, lane.height - 1)
      }
    }

    if ($summary) {
      const scale = makeTimeScale($summary.startTime, $summary.endTime, 0, cssWidth)
      const x = scale.toPixel($playhead)
      ctx.strokeStyle = '#5b8def'
      ctx.lineWidth = 2
      ctx.beginPath()
      ctx.moveTo(x, 0)
      ctx.lineTo(x, Math.max(lanesBottom, 1)) // clamp to lanes, not full canvas
      ctx.stroke()
    }
```

- [ ] **Step 3: Type-check and run the full unit suite**

Run:
```bash
cd /Users/user/GolandProjects/trace-go/frontend
npm run check && npm test
```
Expected: 0 check errors; all unit suites pass (activeAt, graphModel, playback, filter, timeMap, format, timelineLayout, stores/trace).

- [ ] **Step 4: Build the app**

Run:
```bash
cd /Users/user/GolandProjects/trace-go
wails build
```
Expected: builds successfully (frontend bundles d3-force + new component, binary links).

- [ ] **Step 5: Manual visual verification (human)**

Run `wails dev` (or open `build/bin/trace-go.app`), open a trace (e.g. `~/Desktop/trace.out`), and confirm:
1. Below the timeline, a **graph** of goroutine nodes appears, connected by edges, laid out (force-directed) without overlapping piles.
2. **Playing/scrubbing** recolors nodes live (green=running / red=blocked / gray=runnable; dim for not-yet-created/ended) and the layout stays put (no re-jitter on time change). Edges near the playhead time light up blue.
3. **Clicking a node** outlines it white AND outlines that goroutine's lane in the timeline above; clicking it again clears the selection.
4. The timeline **playhead line no longer dangles** far below the lanes (it stops at the last lane).

This needs a human (or the controller running the app). Report observations. If `wails dev` can't launch, report DONE_WITH_CONCERNS noting build + type-check + all unit tests passed and only the live check remains.

- [ ] **Step 6: Commit**

```bash
cd /Users/user/GolandProjects/trace-go
git add frontend/src/App.svelte frontend/src/components/TimelineCanvas.svelte
git commit -m "feat(frontend): split timeline/graph layout, selection highlight, playhead fix"
```

---

## Self-Review Notes

- **Spec coverage:** Live force-directed graph, nodes=goroutines colored by state, edges=inferred causal (spec §4 하단) → Tasks 1, 2, 5. Timeline↔graph sync via shared `$playhead` (spec §4 양방향 동기화) → the graph subscribes to the same store the timeline writes; scrub + playback drive both → Tasks 5, 6. Goroutine click cross-highlight (spec §4) → Tasks 3, 5, 6. Playhead cosmetic fix → Task 6. State-at-time-t coloring matches the timeline's color semantics (reuses `stateColor`).
- **Stability decision:** the force simulation is rebuilt ONLY on node-set change (`$summary`/`$showSystem`), never on `$playhead`/`$selectedId` — those only trigger a redraw. This is what keeps the graph from re-jittering every animation frame and is the key correctness property to verify.
- **Deferred (possible Plan 2D):** edge "flash" tween animation, zoom/pan, large-trace performance/WebGL, hover tooltips on nodes.
- **Type consistency:** `stateAt`/`activeEdges` (activeAt.ts), `buildGraphModel`/`GraphNode`/`GraphLink`/`GraphModel` (graphModel.ts), the extended `TraceStore` (`selectedId`/`setSelected`/`toggleSelected`), and the reuse of `visibleGoroutines`/`stateColor`/`goroutineLabel` are consistent across tasks. The graph and timeline both call `visibleGoroutines($summary,$showSystem)` so the filter stays in lockstep.
- **d3-force usage:** layout only — d3 mutates `node.x/y`; we render to canvas. `forceLink().id(d => d.id)` resolves the numeric `source`/`target` ids to node refs in place (so after simulation, `link.source`/`target` are `GraphNode` objects — the draw code reads `.x/.y` off them, with a null guard for the first frame before positions exist).
- **Manual-verification honesty:** only Task 6 Step 5 needs a running GUI; build (Step 4) is the automated compile gate, and all pure logic + the selection store are unit-tested. DONE_WITH_CONCERNS fallback documented.

# trace-go Plan 2D — Hover Tooltips + Legend (honesty polish)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the visualization *legible and honest* before v1: hovering a timeline interval reveals its block reason; hovering a graph node reveals the goroutine + its state at the playhead; hovering a graph edge reveals **"(inferred) channel/mutex communication"** — surfacing the spec §3 limitation that the trace gives no channel identity. A shared legend explains the state colors.

**Architecture:** All tooltip *content* and *hit-testing* is pure, unit-tested TS (`lib/tooltip.ts`, `lib/hit.ts`). The two canvases gain a `pointermove`/`pointerleave` handler that runs the pure hit-test, builds the pure tooltip text, and shows a positioned `<div>` overlay (the only visual glue). A static `Legend.svelte` is added to the app chrome. No store or data-model changes.

**Tech Stack:** Svelte 3 + TypeScript + Vite, Vitest, HTML Canvas 2D (existing). No new dependencies.

**Scope note:** This is Plan 2D of the `trace-go` v1 spec (`docs/superpowers/specs/2026-06-19-concurrency-visualizer-design.md`). It implements the spec's hover affordances (§4 "블록 구간 hover → 이유 툴팁", §4 그래프 엣지 hover) and the §3 honesty requirement (edges are *inferred* — no channel identity / no value). Plans 1, 2A, 2B, 2C are merged on `main`. Explicitly **out of scope** (a possible later plan): edge "flash" tween animation, graph zoom/pan, large-trace (1000s nodes) WebGL performance.

**Current state (verified):** `TimelineCanvas.svelte` has a `pointerdown`/`pointermove` scrub (drag) + a wrapper `div.timeline-canvas-wrap`; lanes come from `layoutTimeline` (each `LayoutRect` has `state`, `blockReason`, `x`, `width`; constants `LANE_H=18`, `LANE_GAP=3`). `GraphCanvas.svelte` has `nodeAt(px,py)` (radius 10) + `onClick`→`toggleSelected`, a wrapper `div.graph-wrap`, persistent `nodes` (with `x/y` from d3-force) and `links` (whose `source`/`target` are mutated into `GraphNode` refs), and `goroutineById`. `lib/format.ts` exports `IntervalState` + `stateColor`; `lib/activeAt.ts` exports `stateAt`. 41 vitest tests pass.

---

## File Structure

- `frontend/src/lib/tooltip.ts` — pure `intervalTooltip` / `nodeTooltip` / `edgeTooltip` text builders. Test: `tooltip.test.ts`.
- `frontend/src/lib/hit.ts` — pure `hitTimeline` (lane+rect at x/y), `nodeAtPoint`, `distToSegment` (graph edge hover). Test: `hit.test.ts`.
- `frontend/src/components/Legend.svelte` — **new**: static color legend. (Visual.)
- `frontend/src/components/TimelineCanvas.svelte` — **modify**: hover tooltip overlay; use `hitTimeline`. (Visual.)
- `frontend/src/components/GraphCanvas.svelte` — **modify**: hover tooltip overlay (node + nearest edge); use `nodeAtPoint`. (Visual.)
- `frontend/src/App.svelte` — **modify**: render `<Legend/>`. (Visual.)

**Pure-logic-first:** tooltip text + hit-testing are TDD'd; only the overlay rendering, hover wiring, and the static legend are manual-verified.

---

## Task 1: Pure tooltip text builders

**Files:** Create `frontend/src/lib/tooltip.ts`; Test `frontend/src/lib/tooltip.test.ts`.

- [ ] **Step 1: Write the failing test**

Create `frontend/src/lib/tooltip.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { intervalTooltip, nodeTooltip, edgeTooltip } from './tooltip'

describe('intervalTooltip', () => {
  it('shows label, state, and block reason for a blocked interval', () => {
    expect(intervalTooltip('main.worker', 'blocked', 'chan receive')).toBe(
      'main.worker\nblocked · chan receive',
    )
  })
  it('omits the reason when running/runnable or reason is empty', () => {
    expect(intervalTooltip('main.a', 'running', '')).toBe('main.a\nrunning')
    expect(intervalTooltip('g5', 'blocked', '')).toBe('g5\nblocked')
  })
})

describe('nodeTooltip', () => {
  it('shows the goroutine and its state at the playhead', () => {
    expect(nodeTooltip('main.a', 'running')).toBe('main.a\nrunning')
  })
  it('says not-alive when the state is null', () => {
    expect(nodeTooltip('g9', null)).toBe('g9\nnot running at this time')
  })
})

describe('edgeTooltip', () => {
  it('labels the relation as inferred (no channel identity in the trace)', () => {
    expect(edgeTooltip('channel', 'g1', 'g2')).toBe('g1 → g2\nchannel communication (inferred)')
    expect(edgeTooltip('mutex', 'main.a', 'g3')).toBe('main.a → g3\nmutex synchronization (inferred)')
    expect(edgeTooltip('other', 'g1', 'g2')).toBe('g1 → g2\nunblock (inferred)')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run:
```bash
cd /Users/user/GolandProjects/trace-go/frontend
npm test -- tooltip
```
Expected: FAIL — cannot find `./tooltip`.

- [ ] **Step 3: Write the implementation**

Create `frontend/src/lib/tooltip.ts`:
```ts
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
```

- [ ] **Step 4: Run test to verify it passes**

Run:
```bash
cd /Users/user/GolandProjects/trace-go/frontend
npm test -- tooltip
```
Expected: all tests PASS.

- [ ] **Step 5: Commit**

```bash
cd /Users/user/GolandProjects/trace-go
git add frontend/src/lib/tooltip.ts frontend/src/lib/tooltip.test.ts
git commit -m "feat(frontend): add pure tooltip text builders"
```

---

## Task 2: Pure hit-testing

**Files:** Create `frontend/src/lib/hit.ts`; Test `frontend/src/lib/hit.test.ts`.

- [ ] **Step 1: Write the failing test**

Create `frontend/src/lib/hit.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { hitTimeline, nodeAtPoint, distToSegment } from './hit'
import type { Lane } from './timelineLayout'

const lanes: Lane[] = [
  {
    goroutineId: 1,
    label: 'a',
    y: 0,
    height: 18,
    rects: [
      { x: 0, width: 40, state: 'running', color: '#0a0', blockReason: '' },
      { x: 40, width: 60, state: 'blocked', color: '#a00', blockReason: 'chan receive' },
    ],
  },
  { goroutineId: 2, label: 'b', y: 21, height: 18, rects: [{ x: 0, width: 100, state: 'running', color: '#0a0', blockReason: '' }] },
]

describe('hitTimeline', () => {
  const stride = 21 // LANE_H 18 + LANE_GAP 3
  it('finds the lane and the rect under the point', () => {
    const h = hitTimeline(lanes, 50, 5, stride, 18)
    expect(h?.lane.goroutineId).toBe(1)
    expect(h?.rect?.blockReason).toBe('chan receive')
  })
  it('returns null in the inter-lane gap', () => {
    expect(hitTimeline(lanes, 50, 19, stride, 18)).toBeNull() // y 18..21 is gap
  })
  it('returns null below all lanes', () => {
    expect(hitTimeline(lanes, 50, 200, stride, 18)).toBeNull()
  })
  it('returns the lane with a null rect when x is past its intervals', () => {
    const h = hitTimeline(lanes, 500, 26, stride, 18) // lane 2, x beyond width
    expect(h?.lane.goroutineId).toBe(2)
    expect(h?.rect).toBeNull()
  })
})

describe('nodeAtPoint', () => {
  const nodes = [
    { id: 1, label: 'a', x: 100, y: 100 },
    { id: 2, label: 'b', x: 200, y: 100 },
  ]
  it('finds a node within the radius', () => {
    expect(nodeAtPoint(nodes, 104, 103, 10)?.id).toBe(1)
  })
  it('returns undefined when no node is close', () => {
    expect(nodeAtPoint(nodes, 150, 150, 10)).toBeUndefined()
  })
})

describe('distToSegment', () => {
  it('is the perpendicular distance to a horizontal segment', () => {
    expect(distToSegment(50, 10, 0, 0, 100, 0)).toBeCloseTo(10)
  })
  it('clamps to the nearest endpoint past the segment', () => {
    expect(distToSegment(-30, 0, 0, 0, 100, 0)).toBeCloseTo(30)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run:
```bash
cd /Users/user/GolandProjects/trace-go/frontend
npm test -- hit
```
Expected: FAIL — cannot find `./hit`.

- [ ] **Step 3: Write the implementation**

Create `frontend/src/lib/hit.ts`:
```ts
import type { Lane, LayoutRect } from './timelineLayout'

export interface TimelineHit {
  lane: Lane
  rect: LayoutRect | null
}

// hitTimeline finds the lane (and the interval rect, if any) under a point in
// timeline canvas coordinates. Returns null when the point is in the gap
// between lanes or below the last lane.
export function hitTimeline(
  lanes: Lane[],
  x: number,
  y: number,
  stride: number,
  laneHeight: number,
): TimelineHit | null {
  if (y < 0) return null
  const idx = Math.floor(y / stride)
  if (idx < 0 || idx >= lanes.length) return null
  const lane = lanes[idx]
  if (y - lane.y > laneHeight) return null // in the inter-lane gap
  const rect = lane.rects.find((r) => x >= r.x && x < r.x + r.width) ?? null
  return { lane, rect }
}

// nodeAtPoint returns the first node whose center is within radius of the point.
export function nodeAtPoint<T extends { x?: number; y?: number }>(
  nodes: T[],
  px: number,
  py: number,
  radius: number,
): T | undefined {
  return nodes.find((n) => n.x != null && n.y != null && Math.hypot(n.x - px, n.y - py) <= radius)
}

// distToSegment is the shortest distance from point (px,py) to segment a-b,
// clamped to the segment endpoints. Used for graph edge hover hit-testing.
export function distToSegment(
  px: number,
  py: number,
  ax: number,
  ay: number,
  bx: number,
  by: number,
): number {
  const dx = bx - ax
  const dy = by - ay
  const len2 = dx * dx + dy * dy
  if (len2 === 0) return Math.hypot(px - ax, py - ay)
  let t = ((px - ax) * dx + (py - ay) * dy) / len2
  t = Math.max(0, Math.min(1, t))
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy))
}
```

- [ ] **Step 4: Run test to verify it passes**

Run:
```bash
cd /Users/user/GolandProjects/trace-go/frontend
npm test -- hit
```
Expected: all tests PASS.

- [ ] **Step 5: Commit**

```bash
cd /Users/user/GolandProjects/trace-go
git add frontend/src/lib/hit.ts frontend/src/lib/hit.test.ts
git commit -m "feat(frontend): add pure hit-testing for tooltips"
```

---

## Task 3: Legend component (manual-verified)

**Files:** Create `frontend/src/components/Legend.svelte`; Modify `frontend/src/App.svelte`.

- [ ] **Step 1: Write the Legend**

Create `frontend/src/components/Legend.svelte`:
```svelte
<script lang="ts">
  import { stateColor } from '../lib/format'

  const states: { label: string; color: string }[] = [
    { label: 'running', color: stateColor('running') },
    { label: 'runnable', color: stateColor('runnable') },
    { label: 'blocked', color: stateColor('blocked') },
    { label: 'not alive', color: '#2a2e38' },
  ]
</script>

<div class="legend">
  {#each states as s}
    <span class="item"><span class="swatch" style="background:{s.color}"></span>{s.label}</span>
  {/each}
  <span class="item"><span class="edge active"></span>edge (firing now)</span>
  <span class="item"><span class="edge"></span>edge (inferred link)</span>
</div>

<style>
  .legend { display: flex; flex-wrap: wrap; gap: 14px; padding: 6px 14px; border-top: 1px solid #2a2e38; font-size: 12px; color: #8a93a3; }
  .item { display: flex; align-items: center; gap: 6px; }
  .swatch { width: 12px; height: 12px; border-radius: 3px; display: inline-block; }
  .edge { width: 16px; height: 0; border-top: 2px solid #2a2e38; display: inline-block; }
  .edge.active { border-top-color: #5b8def; }
</style>
```

- [ ] **Step 2: Render the Legend at the bottom of App.svelte**

In `frontend/src/App.svelte`, add the import:
```svelte
  import Legend from './components/Legend.svelte'
```
Then render `<Legend />` as the last child inside `<main>`, after the `{#if $summary} ... {:else} ... {/if}` block but still inside `</main>`, guarded so it only shows with a trace:
```svelte
  {#if $summary}<Legend />{/if}
```

- [ ] **Step 3: Type-check**

Run:
```bash
cd /Users/user/GolandProjects/trace-go/frontend
npm run check
```
Expected: 0 errors.

- [ ] **Step 4: Commit**

```bash
cd /Users/user/GolandProjects/trace-go
git add frontend/src/components/Legend.svelte frontend/src/App.svelte
git commit -m "feat(frontend): add color legend"
```

---

## Task 4: Timeline hover tooltip (manual-verified)

**Files:** Modify `frontend/src/components/TimelineCanvas.svelte`.

- [ ] **Step 1: Add hover state, imports, and handlers**

In `frontend/src/components/TimelineCanvas.svelte`:

(a) Add imports:
```svelte
  import { hitTimeline } from '../lib/hit'
  import { intervalTooltip } from '../lib/tooltip'
```

(b) Add hover state (near the other `let` declarations):
```svelte
  let tip: { text: string; x: number; y: number } | null = null
```

(c) Add a hover handler and update the existing pointer handlers. Replace the existing `onPointerMove` with one that scrubs while dragging and otherwise updates the tooltip, and add a leave handler:
```svelte
  function onPointerMove(e: PointerEvent) {
    if (dragging) {
      setPlayhead(timeAtClientX(e.clientX))
      tip = null
      return
    }
    const rect = canvas.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top
    const h = hitTimeline(lanes, x, y, LANE_H + LANE_GAP, LANE_H)
    if (h && h.rect) {
      tip = { text: intervalTooltip(h.lane.label, h.rect.state, h.rect.blockReason), x, y }
    } else {
      tip = null
    }
  }
  function onPointerLeave() {
    tip = null
  }
```

- [ ] **Step 2: Render the tooltip overlay**

In `frontend/src/components/TimelineCanvas.svelte`, update the markup: make the wrapper positioned, add `on:pointerleave`, and add the tooltip div. Replace the `<div ...><canvas .../></div>` block with:
```svelte
<div bind:this={container} class="timeline-canvas-wrap" on:pointerleave={onPointerLeave}>
  <canvas
    bind:this={canvas}
    on:pointerdown={onPointerDown}
    on:pointermove={onPointerMove}
    style="width:100%; cursor: ew-resize; display:block;"
  ></canvas>
  {#if tip}
    <div class="tip" style="left:{tip.x + 12}px; top:{tip.y + 12}px">{tip.text}</div>
  {/if}
</div>
```
And update the `<style>` block — replace `.timeline-canvas-wrap { width: 100%; }` with:
```css
  .timeline-canvas-wrap { width: 100%; position: relative; }
  .tip {
    position: absolute; pointer-events: none; white-space: pre; z-index: 10;
    background: #161922; color: #cdd3df; border: 1px solid #2a2e38;
    border-radius: 4px; padding: 4px 8px; font-size: 12px; line-height: 1.35;
  }
```

- [ ] **Step 3: Type-check and run the full unit suite**

Run:
```bash
cd /Users/user/GolandProjects/trace-go/frontend
npm run check && npm test
```
Expected: 0 check errors; all unit suites pass (tooltip, hit, + existing).

- [ ] **Step 4: Commit**

```bash
cd /Users/user/GolandProjects/trace-go
git add frontend/src/components/TimelineCanvas.svelte
git commit -m "feat(frontend): timeline interval hover tooltip"
```

---

## Task 5: Graph hover tooltip + build verify (manual-verified)

**Files:** Modify `frontend/src/components/GraphCanvas.svelte`.

- [ ] **Step 1: Add hover state, imports, and refactor hit-testing**

In `frontend/src/components/GraphCanvas.svelte`:

(a) Add imports:
```svelte
  import { nodeAtPoint, distToSegment } from '../lib/hit'
  import { nodeTooltip, edgeTooltip } from '../lib/tooltip'
  import { goroutineLabel } from '../lib/format'
```
(If `goroutineLabel` is already imported elsewhere, don't duplicate; it lives in `../lib/format`.)

(b) Add hover state (near the other `let` declarations):
```svelte
  let tip: { text: string; x: number; y: number } | null = null
```

(c) Replace the existing `nodeAt` function and `onClick` to use the shared `nodeAtPoint`, and add hover handlers:
```svelte
  function onClick(e: MouseEvent) {
    const rect = canvas.getBoundingClientRect()
    const n = nodeAtPoint(nodes, e.clientX - rect.left, e.clientY - rect.top, 10)
    if (n) traceStore.toggleSelected(n.id)
  }

  function labelOf(id: number): string {
    const g = goroutineById.get(id)
    return g ? goroutineLabel(g) : `g${id}`
  }

  function onPointerMove(e: PointerEvent) {
    const rect = canvas.getBoundingClientRect()
    const px = e.clientX - rect.left
    const py = e.clientY - rect.top
    // Node hover wins over edge hover.
    const n = nodeAtPoint(nodes, px, py, 10)
    if (n) {
      const g = goroutineById.get(n.id)
      tip = { text: nodeTooltip(n.label, g ? stateAt(g, $playhead) : null), x: px, y: py }
      return
    }
    // Nearest edge within 5px.
    let best: { l: GraphLink; d: number } | null = null
    for (const l of links) {
      const s = l.source as unknown as GraphNode
      const t = l.target as unknown as GraphNode
      if (s.x == null || t.x == null) continue
      const d = distToSegment(px, py, s.x, s.y!, t.x, t.y!)
      if (d <= 5 && (!best || d < best.d)) best = { l, d }
    }
    if (best) {
      const s = best.l.source as unknown as GraphNode
      const t = best.l.target as unknown as GraphNode
      tip = { text: edgeTooltip(best.l.category, labelOf(s.id), labelOf(t.id)), x: px, y: py }
    } else {
      tip = null
    }
  }
  function onPointerLeave() {
    tip = null
  }
```
(Delete the old standalone `nodeAt` function — `onClick` now uses `nodeAtPoint`.)

- [ ] **Step 2: Render the tooltip overlay**

In `frontend/src/components/GraphCanvas.svelte`, update the markup to add hover handlers and the tooltip div. Replace the `<div ...><canvas .../></div>` block with:
```svelte
<div bind:this={container} class="graph-wrap" on:pointerleave={onPointerLeave}>
  <canvas
    bind:this={canvas}
    on:click={onClick}
    on:pointermove={onPointerMove}
    style="width:100%; display:block; cursor:pointer;"
  ></canvas>
  {#if tip}
    <div class="tip" style="left:{tip.x + 12}px; top:{tip.y + 12}px">{tip.text}</div>
  {/if}
</div>
```
And update the `<style>` — add to it:
```css
  .graph-wrap { position: relative; }
  .tip {
    position: absolute; pointer-events: none; white-space: pre; z-index: 10;
    background: #161922; color: #cdd3df; border: 1px solid #2a2e38;
    border-radius: 4px; padding: 4px 8px; font-size: 12px; line-height: 1.35;
  }
```
(Keep the existing `.graph-wrap { width: 100%; height: 100%; min-height: 280px; }` rule; merging `position: relative` into it is also fine.)

- [ ] **Step 3: Type-check and run the full unit suite**

Run:
```bash
cd /Users/user/GolandProjects/trace-go/frontend
npm run check && npm test
```
Expected: 0 check errors; all unit suites pass.

- [ ] **Step 4: Build the app**

Run:
```bash
cd /Users/user/GolandProjects/trace-go
wails build
```
Expected: builds successfully.

- [ ] **Step 5: Manual visual verification (human)**

Run `wails dev` (or open `build/bin/trace-go.app`), open a trace (e.g. `~/Desktop/trace.out`), and confirm:
1. Hovering a **timeline interval** shows a tooltip with the goroutine label and `state · reason` (e.g. `blocked · chan receive`); it disappears when leaving the canvas; scrubbing (drag) still works and suppresses the tooltip.
2. Hovering a **graph node** shows `label` + its state at the current playhead (or "not running at this time").
3. Hovering a **graph edge** shows `gA → gB` + `channel communication (inferred)` / `mutex synchronization (inferred)` — confirming the honesty label.
4. A **legend** at the bottom explains the state colors and the two edge styles.

This needs a human (or the controller running the app). Report observations. If `wails dev` can't launch, report DONE_WITH_CONCERNS noting build + type-check + all unit tests passed and only the live check remains.

- [ ] **Step 6: Commit**

```bash
cd /Users/user/GolandProjects/trace-go
git add frontend/src/components/GraphCanvas.svelte
git commit -m "feat(frontend): graph node/edge hover tooltips with inferred-edge label"
```

---

## Self-Review Notes

- **Spec coverage:** Timeline block-reason hover tooltip (spec §4 "블록 구간 hover → 이유 툴팁") → Tasks 1, 2, 4. Graph node/edge hover with the **inferred** honesty label for edges (spec §3 "추정된 채널 통신" — no channel identity / no value) → Tasks 1, 2, 5. Color legend (clarity) → Task 3. All tooltip text + hit-testing is pure and unit-tested; only overlays/legend are manual (spec §6).
- **Out of scope (later):** edge flash tween, zoom/pan, large-trace WebGL — unchanged from the 2C deferral list.
- **Type consistency:** `intervalTooltip`/`nodeTooltip`/`edgeTooltip` (tooltip.ts) consume `IntervalState`/`EdgeCategory`; `hitTimeline`/`nodeAtPoint`/`distToSegment` (hit.ts) consume `Lane`/`LayoutRect` from `timelineLayout.ts`. `GraphCanvas` reuses `nodeAtPoint` for BOTH click and hover (the old inline `nodeAt` is removed). `goroutineLabel`/`stateColor` reused from `format.ts`.
- **No data/store changes:** purely additive UI; the playback/filter/selection behavior from 2A–2C is untouched.
- **Interaction guards:** timeline tooltip is suppressed while dragging (scrub takes priority) and cleared on `pointerleave`; graph node hover wins over edge hover; tooltip divs are `pointer-events: none` so they never steal hover/click.
- **Manual-verification honesty:** only Task 5 Step 5 needs a running GUI; build (Step 4) is the automated compile gate, and all pure logic is unit-tested. DONE_WITH_CONCERNS fallback documented.

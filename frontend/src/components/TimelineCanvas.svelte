<script lang="ts">
  import { onMount } from 'svelte'
  import { traceStore } from '../stores/trace'
  import { layoutTimeline, type Lane } from '../lib/timelineLayout'
  import { makeTimeScale } from '../lib/timeMap'
  import { visibleGoroutines } from '../lib/filter'
  import { hitTimeline } from '../lib/hit'
  import { intervalTooltip } from '../lib/tooltip'

  const { summary, playhead, showSystem, selectedId, setPlayhead } = traceStore

  let container: HTMLDivElement
  let canvas: HTMLCanvasElement
  let cssWidth = 800 // CSS (layout) pixel width of the time axis; tracked to the container
  const LANE_H = 18
  const LANE_GAP = 3

  let dragging = false
  let tip: { text: string; x: number; y: number } | null = null

  // Layout and height are derived reactively from the loaded summary and the
  // current width. Using $summary/$playhead auto-subscriptions means Svelte
  // owns subscription lifecycle (no manual leak).
  $: visible = $summary ? visibleGoroutines($summary, $showSystem) : []
  $: lanes = $summary
    ? layoutTimeline(
        { ...$summary, goroutines: visible },
        { width: cssWidth, laneHeight: LANE_H, laneGap: LANE_GAP },
      )
    : ([] as Lane[])
  $: cssHeight = Math.max(400, visible.length * (LANE_H + LANE_GAP))

  // Redraw whenever any input to the picture changes. draw() no-ops until the
  // canvas is mounted; onMount triggers the first real paint.
  $: void [$playhead, lanes, cssWidth, cssHeight, $selectedId], draw()

  function draw() {
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // Size the bitmap to the CSS box so layout/pointer pixels share one
    // coordinate space (the playhead must land under the cursor), and scale by
    // devicePixelRatio for crisp lines. Setting canvas.width is a DOM op, not a
    // reactive write, so this does not re-trigger the reactive block above.
    const dpr = window.devicePixelRatio || 1
    canvas.width = Math.round(cssWidth * dpr)
    canvas.height = Math.round(cssHeight * dpr)
    canvas.style.height = cssHeight + 'px'
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)

    ctx.fillStyle = '#0f1117'
    ctx.fillRect(0, 0, cssWidth, cssHeight)

    for (const lane of lanes) {
      for (const r of lane.rects) {
        ctx.fillStyle = r.color
        ctx.fillRect(r.x, lane.y, r.width, lane.height)
      }
    }

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
  }

  function timeAtClientX(clientX: number): number {
    if (!$summary) return 0
    const rect = canvas.getBoundingClientRect()
    const scale = makeTimeScale($summary.startTime, $summary.endTime, 0, cssWidth)
    return scale.toTime(clientX - rect.left)
  }

  function onPointerDown(e: PointerEvent) {
    dragging = true
    setPlayhead(timeAtClientX(e.clientX))
  }
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
  function onPointerUp() {
    dragging = false
  }

  onMount(() => {
    const measure = () => {
      cssWidth = container.clientWidth || cssWidth
    }
    measure()
    draw()
    const ro = new ResizeObserver(measure)
    ro.observe(container)
    window.addEventListener('pointerup', onPointerUp)
    return () => {
      ro.disconnect()
      window.removeEventListener('pointerup', onPointerUp)
    }
  })
</script>

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

<style>
  .timeline-canvas-wrap { width: 100%; position: relative; }
  .tip {
    position: absolute; pointer-events: none; white-space: pre; z-index: 10;
    background: #161922; color: #cdd3df; border: 1px solid #2a2e38;
    border-radius: 4px; padding: 4px 8px; font-size: 12px; line-height: 1.35;
  }
</style>

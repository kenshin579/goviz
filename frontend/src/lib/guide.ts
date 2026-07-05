// Coachmark-tour geometry, ported from the design mockup's measure() logic.
// Pure: GuideTour.svelte feeds it getBoundingClientRect + viewport numbers.

export const TOUR_TARGETS = ['timeline', 'header', 'graph', 'legend'] as const
export const POP_W = 330
export const POP_H = 210
const SPOT_PAD = 4
const GAP = 14
const MARGIN = 12

export interface TargetRect {
  left: number
  top: number
  width: number
  height: number
  bottom: number
}

export interface TourPlacement {
  spot: { x: number; y: number; w: number; h: number }
  pop: { x: number; y: number }
}

// placeTour puts the spotlight around the target and the popover below it,
// flipping above when there is no room, finally clamping into the viewport.
export function placeTour(r: TargetRect, vw: number, vh: number): TourPlacement {
  const spot = { x: r.left - SPOT_PAD, y: r.top - SPOT_PAD, w: r.width + SPOT_PAD * 2, h: r.height + SPOT_PAD * 2 }
  const px = Math.min(Math.max(r.left + 24, MARGIN), vw - POP_W - 24)
  let py = r.bottom + GAP
  if (py + POP_H > vh) {
    py = r.top - POP_H - GAP
    if (py < MARGIN) py = Math.min(Math.max(MARGIN, r.top + GAP), vh - POP_H)
  }
  return { spot, pop: { x: px, y: py } }
}

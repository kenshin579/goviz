// A linear, invertible mapping between trace time (ns) and pixels.
export interface TimeScale {
  toPixel(time: number): number
  toTime(pixel: number): number
}

// makeTimeScale maps [domainStart, domainEnd] onto [rangeStart, rangeEnd].
// A zero-width domain collapses to rangeStart (no division by zero).
export function makeTimeScale(
  domainStart: number,
  domainEnd: number,
  rangeStart: number,
  rangeEnd: number,
): TimeScale {
  const domainSpan = domainEnd - domainStart
  const rangeSpan = rangeEnd - rangeStart
  const k = domainSpan === 0 ? 0 : rangeSpan / domainSpan
  return {
    toPixel: (time) => rangeStart + (time - domainStart) * k,
    toTime: (pixel) => (k === 0 ? domainStart : domainStart + (pixel - rangeStart) / k),
  }
}

// Shared, dependency-free chart math. Pure functions — server-safe, no React.

export interface PlotBox {
  left: number
  right: number
  top: number
  bottom: number
}

/**
 * Nice-number axis scaling (Heckbert's "Nice Numbers for Graph Labels").
 * Rounds [min,max] out to friendly bounds and returns the tick values so a
 * chart draws `ticks` evenly-spaced gridlines at round numbers.
 */
export function niceScale(min: number, max: number, ticks = 5) {
  if (min === max) {
    // Flat series — open a symmetric window so the line sits mid-plot.
    const pad = Math.abs(min) || 1
    min -= pad
    max += pad
  }
  const range = niceNum(max - min, false)
  const step = niceNum(range / (ticks - 1), true)
  const niceMin = Math.floor(min / step) * step
  const niceMax = Math.ceil(max / step) * step
  const values: number[] = []
  for (let v = niceMin; v <= niceMax + step / 2; v += step) {
    values.push(Number(v.toFixed(6)))
  }
  return { min: niceMin, max: niceMax, step, values }
}

function niceNum(range: number, round: boolean): number {
  const exp = Math.floor(Math.log10(range || 1))
  const frac = range / Math.pow(10, exp)
  let nice: number
  if (round) {
    if (frac < 1.5) nice = 1
    else if (frac < 3) nice = 2
    else if (frac < 7) nice = 5
    else nice = 10
  } else {
    if (frac <= 1) nice = 1
    else if (frac <= 2) nice = 2
    else if (frac <= 5) nice = 5
    else nice = 10
  }
  return nice * Math.pow(10, exp)
}

/** Map value on [min,max] to a y-coordinate in the plot box (inverted: max → top). */
export function scaleY(v: number, min: number, max: number, box: PlotBox): number {
  const t = max === min ? 0.5 : (v - min) / (max - min)
  return box.bottom - t * (box.bottom - box.top)
}

/** Evenly distribute point `i` of `n` across the plot box's horizontal span. */
export function scaleX(i: number, n: number, box: PlotBox): number {
  return n <= 1 ? box.left : box.left + (i / (n - 1)) * (box.right - box.left)
}

/** Round to 2dp for compact, deterministic SVG path strings. */
export function r2(n: number): number {
  return Math.round(n * 100) / 100
}

/**
 * Deterministic id from a data series — keeps <linearGradient> ids unique across
 * chart instances on a page without useId (so components stay server-safe and
 * free of hydration mismatches).
 */
export function chartId(prefix: string, data: number[]): string {
  let h = 0
  for (const v of data) h = (Math.imul(h, 31) + Math.round(v * 100)) | 0
  return `${prefix}-${(h >>> 0).toString(36)}`
}

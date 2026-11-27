import type { Point } from "#lib/tauri/bindings.ts";

/*
 * Pen input arrives rounded to whole device pixels: WebView2 on a 150 %
 * display steps in exact multiples of 2/3 CSS px. Sampled densely, a smooth
 * curve becomes a staircase of one-pixel steps; drawn thick, that shows as
 * kinks and bumpy edges (measured on real handwriting: median turn of 18°
 * per point, where a smooth hand turns a degree or two). A spline through
 * the points would keep the staircase; averaging over a pixel or two
 * removes it while letter shapes and corners stay.
 *
 * Done at render time on the stored input, which is kept as recorded, so
 * the amount can be retuned later without losing anything.
 */

/** How far the smoothing reaches, in grid steps (chosen on real writing). */
const SIGMA_STEPS = 1.2;

/**
 * The input grid of a stroke: its smallest non-zero coordinate step, which
 * is one device pixel at the zoom it was written at. 0 when there is no
 * step (a dot). Precise input (no rounding) gives a tiny grid and hence
 * almost no smoothing.
 */
export function gridStep(points: Point[]): number {
  let q = Infinity;
  for (let i = 1; i < points.length; i++) {
    const dx = Math.abs(points[i].x - points[i - 1].x);
    const dy = Math.abs(points[i].y - points[i - 1].y);
    if (dx > 1e-3 && dx < q) q = dx;
    if (dy > 1e-3 && dy < q) q = dy;
  }
  return Number.isFinite(q) ? q : 0;
}

/**
 * Gaussian smoothing along the stroke's length, over about one grid step.
 * Both ends stay exactly where they are, and the window shrinks towards
 * them so it never pulls a stroke's end inwards. Pressure is smoothed with
 * the same weights, which also evens out stepped pressure readings.
 */
export function denoise(points: Point[]): Point[] {
  const n = points.length;
  const q = gridStep(points);
  if (n < 3 || q === 0) return points;

  const sigma = q * SIGMA_STEPS;
  const reach = sigma * 3;
  const twoSigmaSq = 2 * sigma * sigma;
  const s = [0];
  for (let i = 1; i < n; i++)
    s.push(s[i - 1] + Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y));

  return points.map((p, i) => {
    if (i === 0 || i === n - 1) return p;
    const r = Math.min(reach, s[i], s[n - 1] - s[i]);
    let w = 0;
    let x = 0;
    let y = 0;
    let pressure = 0;
    const add = (j: number) => {
      const d = s[j] - s[i];
      const wj = Math.exp(-(d * d) / twoSigmaSq);
      w += wj;
      x += points[j].x * wj;
      y += points[j].y * wj;
      pressure += points[j].pressure * wj;
    };
    for (let j = i; j >= 0 && s[i] - s[j] <= r; j--) add(j);
    for (let j = i + 1; j < n && s[j] - s[i] <= r; j++) add(j);
    return { x: x / w, y: y / w, pressure: pressure / w };
  });
}

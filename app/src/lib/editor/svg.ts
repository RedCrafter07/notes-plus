import type { Point, Stroke } from "#lib/tauri/bindings.ts";
import getStroke, {
  getStrokeOutlinePoints,
  getStrokePoints,
  type StrokeOptions,
  type StrokePoint,
} from "perfect-freehand";

export function getSvgPathFromStroke(stroke: [number, number][]) {
  if (!stroke.length) return "";

  // Taken from https://github.com/steveruizok/perfect-freehand/blob/main/tutorial/script.md#smoothing
  const d = stroke
    .reduce(
      (acc, [x0, y0], i, arr) => {
        const [x1, y1] = arr[(i + 1) % arr.length];
        acc.push(x0, y0, (x0 + x1) / 2, (y0 + y1) / 2);
        return acc;
      },
      ["M", ...stroke[0], "Q"],
    )
    .concat("Z")
    .join(" ");

  return d;
}

/**
 * One set of options, so the eraser cuts the line the renderer draws.
 *
 * `thinning` is how much pressure changes the width (`Stroke.thinning`).
 * `simulatePressure` is off: perfect-freehand would otherwise ignore the
 * pen's real pressure and fake one from drawing speed. A mouse reports a
 * constant 0.5, which is the nominal width, so mouse strokes stay even.
 */
function strokeOptions(size: number, drawing: boolean, thinning = 0): StrokeOptions {
  return {
    size,
    thinning,
    simulatePressure: false,
    last: !drawing,
    smoothing: 0.25,
    streamline: 0.25,
  };
}

export function inputToPath(
  inputPoints: Point[],
  t: number,
  drawing: boolean,
  thinning = 0,
): string {
  return getSvgPathFromStroke(getStroke(inputPoints, strokeOptions(t, drawing, thinning)));
}

/**
 * The centre line perfect-freehand draws for raw input: streamlined, with
 * the first stroke-width of jitter skipped. Erasing cuts this line, and the
 * pieces are drawn from it as they are (`smoothed`), so they stay exactly
 * where the ink was.
 */
export function centerLine(points: Point[], size: number): Point[] {
  return getStrokePoints(points, strokeOptions(size, false)).map((s) => ({
    x: s.point[0],
    y: s.point[1],
    pressure: s.pressure,
  }));
}

/** perfect-freehand's per-point data for a centre line, without smoothing it again. */
function asStrokePoints(points: Point[]): StrokePoint[] {
  const out: StrokePoint[] = [];
  let runningLength = 0;
  for (const p of points) {
    const prev = out[out.length - 1];
    const point: [number, number] = [p.x, p.y];
    if (!prev) {
      out.push({ point, pressure: p.pressure, vector: [1, 1], distance: 0, runningLength: 0 });
      continue;
    }
    const dx = prev.point[0] - p.x;
    const dy = prev.point[1] - p.y;
    const distance = Math.hypot(dx, dy);
    if (distance === 0) continue;
    runningLength += distance;
    out.push({ point, pressure: p.pressure, vector: [dx / distance, dy / distance], distance, runningLength });
  }
  // Like getStrokePoints: the first point faces the same way as the second.
  if (out.length > 1) out[0].vector = out[1].vector;
  return out;
}

/** SVG path of a committed stroke. */
export function strokeToPath(s: Stroke): string {
  const thinning = s.thinning ?? 0;
  if (!s.smoothed) return inputToPath(s.points, s.thickness, false, thinning);
  const opts = strokeOptions(s.thickness, false, thinning);
  return getSvgPathFromStroke(getStrokeOutlinePoints(asStrokePoints(s.points), opts));
}

import type { Point } from "#lib/tauri/bindings.ts";
import type { Point2D } from "#lib/util/canvasBounds.ts";

/*
 * Shape recognition for "hold to draw shapes": when the pen rests at the
 * end of a stroke, the stroke so far is replaced by the clean shape it most
 * resembles. A shape is stored as an ordinary stroke whose points are its
 * outline (`shapePoints`), drawn as it is (`Stroke.smoothed`) so corners
 * stay sharp. Nothing in the file format knows about shapes.
 *
 * Errors are mean distances from the drawn points to a candidate, as a
 * fraction of the drawing's size (its bounding-box diagonal), so the
 * thresholds hold at any size and zoom.
 */

export type Shape =
  | { kind: "line"; from: Point2D; to: Point2D }
  /** A triangle, rectangle or other quadrilateral, corners in drawing order. */
  | { kind: "polygon"; corners: Point2D[] }
  /** `angle` turns the x radius away from the x axis (radians). */
  | { kind: "ellipse"; center: Point2D; rx: number; ry: number; angle: number };

/** Lines and edges this close to a multiple of 45° (or 90° for shapes) snap to it. */
const SNAP_ANGLE = (5 * Math.PI) / 180;
/** A stroke is a line if no point is further than this from the chord (fraction of its length). */
const LINE_DEVIATION = 0.06;
/** Ends this close together (fraction of the size) make the stroke a closed shape. */
const CLOSED_GAP = 0.25;
/** Simplification tolerance for finding corners (fraction of the size). */
const CORNER_TOLERANCE = 0.06;
/** A vertex that turns less than this is not a corner. */
const MIN_TURN = (30 * Math.PI) / 180;
/** The best candidate must fit at least this well (fraction of the size). */
const MAX_ERROR = 0.035;
/** Corners within this of 90° make a quadrilateral a rectangle. */
const RIGHT_ANGLE = (15 * Math.PI) / 180;
/** Radii within this fraction of each other make an ellipse a circle. */
const ROUND = 0.12;

const RESAMPLE = 96;
const ELLIPSE_STEPS = 72;
/** Where points sit along a polygon edge (its end is the next edge's start). */
const EDGE_STEPS = [0, 0.005, 0.02, 0.1, 0.25, 0.5, 0.75, 0.9, 0.98, 0.995];

export function recognizeShape(input: Point2D[]): Shape | undefined {
  const pts = resample(input, RESAMPLE);
  if (pts.length < 3) return;
  const size = diagonal(pts);
  if (size === 0) return;
  const first = pts[0];
  const last = pts[pts.length - 1];
  const chord = dist(first, last);

  if (chord > 0 && Math.max(...pts.map((p) => segmentDist(p, first, last))) <= LINE_DEVIATION * chord)
    return { kind: "line", from: first, to: snapLineEnd(first, last) };

  if (chord > CLOSED_GAP * size) return; // an open curve: leave it as drawn

  const loop = pts.slice(0, -1);
  const candidates: { shape: Shape; error: number }[] = [];

  const ellipse = fitEllipse(loop);
  candidates.push({ shape: ellipse, error: ellipseError(loop, ellipse) / size });

  const corners = findCorners(loop, CORNER_TOLERANCE * size);
  if (corners.length === 3 || corners.length === 4) {
    const polygon: Shape = { kind: "polygon", corners: corners.length === 4 ? regularize(corners) : corners };
    candidates.push({ shape: polygon, error: polygonError(loop, polygon.corners) / size });
  }

  const best = candidates.reduce((a, b) => (b.error < a.error ? b : a));
  return best.error <= MAX_ERROR ? best.shape : undefined;
}

/** The end of a line from `from` towards `to`, snapped to a multiple of 45° when close. */
export function snapLineEnd(from: Point2D, to: Point2D): Point2D {
  const len = dist(from, to);
  const a = Math.atan2(to.y - from.y, to.x - from.x);
  const step = Math.PI / 4;
  const snapped = Math.round(a / step) * step;
  if (Math.abs(a - snapped) > SNAP_ANGLE) return to;
  return { x: from.x + Math.cos(snapped) * len, y: from.y + Math.sin(snapped) * len };
}

/** The points of a stroke drawing `shape` (closed shapes end where they start). */
export function shapePoints(shape: Shape, pressure = 0.5): Point[] {
  const at = (p: Point2D): Point => ({ x: p.x, y: p.y, pressure });
  switch (shape.kind) {
    case "line":
      return [at(shape.from), at(shape.to)];
    case "polygon": {
      // Points along each edge, crowded at the corners: with a point only at
      // each corner the outline (which curves between its points) bulges the
      // edges, and perfect-freehand treats a 90° turn as a smooth one.
      const c = [...shape.corners, shape.corners[0]];
      const out: Point[] = [];
      for (let i = 0; i < c.length - 1; i++)
        for (const t of EDGE_STEPS)
          out.push(at({ x: c[i].x + (c[i + 1].x - c[i].x) * t, y: c[i].y + (c[i + 1].y - c[i].y) * t }));
      out.push(at(c[c.length - 1]));
      return out;
    }
    case "ellipse": {
      const { center, rx, ry, angle } = shape;
      const cos = Math.cos(angle);
      const sin = Math.sin(angle);
      return Array.from({ length: ELLIPSE_STEPS + 1 }, (_, i) => {
        const t = (i / ELLIPSE_STEPS) * Math.PI * 2;
        const x = Math.cos(t) * rx;
        const y = Math.sin(t) * ry;
        return at({ x: center.x + x * cos - y * sin, y: center.y + x * sin + y * cos });
      });
    }
  }
}

// ----------------------------------------------------------------- fitting

/** Axes from the points' spread; radii from their extent along those axes. */
function fitEllipse(pts: Point2D[]): Shape & { kind: "ellipse" } {
  const m = mean(pts);
  let sxx = 0;
  let syy = 0;
  let sxy = 0;
  for (const p of pts) {
    const dx = p.x - m.x;
    const dy = p.y - m.y;
    sxx += dx * dx;
    syy += dy * dy;
    sxy += dx * dy;
  }
  let angle = 0.5 * Math.atan2(2 * sxy, sxx - syy);
  const extent = (a: number) => {
    const ux = Math.cos(a);
    const uy = Math.sin(a);
    const proj = pts.map((p) => p.x * ux + p.y * uy);
    const lo = Math.min(...proj);
    const hi = Math.max(...proj);
    return { r: (hi - lo) / 2, mid: (hi + lo) / 2 };
  };
  const u = extent(angle);
  const v = extent(angle + Math.PI / 2);
  const center = {
    x: u.mid * Math.cos(angle) - v.mid * Math.sin(angle),
    y: u.mid * Math.sin(angle) + v.mid * Math.cos(angle),
  };
  let rx = u.r;
  let ry = v.r;
  if (Math.abs(rx - ry) <= ROUND * Math.max(rx, ry)) {
    rx = ry = (rx + ry) / 2;
    angle = 0;
  } else {
    // Upright when nearly so (an ellipse turned by 90° is the same shape).
    const q = Math.PI / 2;
    const snapped = Math.round(angle / q) * q;
    if (Math.abs(angle - snapped) <= SNAP_ANGLE) angle = snapped;
  }
  return { kind: "ellipse", center, rx, ry, angle };
}

/** Approximate mean distance of the points from the ellipse. */
function ellipseError(pts: Point2D[], e: Shape & { kind: "ellipse" }): number {
  if (e.rx === 0 || e.ry === 0) return Infinity;
  const cos = Math.cos(-e.angle);
  const sin = Math.sin(-e.angle);
  const r = (e.rx + e.ry) / 2;
  let sum = 0;
  for (const p of pts) {
    const dx = p.x - e.center.x;
    const dy = p.y - e.center.y;
    const x = dx * cos - dy * sin;
    const y = dx * sin + dy * cos;
    sum += Math.abs(Math.hypot(x / e.rx, y / e.ry) - 1) * r;
  }
  return sum / pts.length;
}

function polygonError(pts: Point2D[], corners: Point2D[]): number {
  let sum = 0;
  for (const p of pts) {
    let d = Infinity;
    for (let i = 0; i < corners.length; i++)
      d = Math.min(d, segmentDist(p, corners[i], corners[(i + 1) % corners.length]));
    sum += d;
  }
  return sum / pts.length;
}

/**
 * Corners of a closed loop: simplify it (Douglas-Peucker, split at the
 * point furthest from the start, since the start is arbitrary), then drop
 * vertices that hardly turn until none is left.
 */
export function findCorners(loop: Point2D[], tolerance: number): Point2D[] {
  let far = 0;
  for (let i = 1; i < loop.length; i++) if (dist(loop[i], loop[0]) > dist(loop[far], loop[0])) far = i;
  if (far === 0) return [];
  const closed = [...loop, loop[0]];
  const a = simplify(closed.slice(0, far + 1), tolerance);
  const b = simplify(closed.slice(far), tolerance);
  let v = [...a.slice(0, -1), ...b.slice(0, -1)];

  for (let changed = true; changed && v.length > 2; ) {
    changed = false;
    let flattest = -1;
    let least = MIN_TURN;
    for (let i = 0; i < v.length; i++) {
      const t = turn(v[(i + v.length - 1) % v.length], v[i], v[(i + 1) % v.length]);
      if (t < least) {
        least = t;
        flattest = i;
      }
    }
    if (flattest >= 0) {
      v = v.filter((_, i) => i !== flattest);
      changed = true;
    }
  }
  return v;
}

function simplify(pts: Point2D[], tolerance: number): Point2D[] {
  if (pts.length < 3) return pts;
  const a = pts[0];
  const b = pts[pts.length - 1];
  let worst = 0;
  let index = 0;
  for (let i = 1; i < pts.length - 1; i++) {
    const d = segmentDist(pts[i], a, b);
    if (d > worst) {
      worst = d;
      index = i;
    }
  }
  if (worst <= tolerance) return [a, b];
  return [...simplify(pts.slice(0, index + 1), tolerance).slice(0, -1), ...simplify(pts.slice(index), tolerance)];
}

/**
 * A quadrilateral whose corners are all near right angles becomes a
 * rectangle: edges along the mean edge direction (upright when close),
 * sides at the average of each pair of opposite corners. Others stay as
 * drawn.
 */
function regularize(c: Point2D[]): Point2D[] {
  for (let i = 0; i < 4; i++) {
    const t = turn(c[(i + 3) % 4], c[i], c[(i + 1) % 4]);
    if (Math.abs(t - Math.PI / 2) > RIGHT_ANGLE) return c;
  }
  // Mean direction modulo 90°: average the edge angles taken four times over.
  let sx = 0;
  let sy = 0;
  for (let i = 0; i < 4; i++) {
    const a = Math.atan2(c[(i + 1) % 4].y - c[i].y, c[(i + 1) % 4].x - c[i].x);
    sx += Math.cos(4 * a);
    sy += Math.sin(4 * a);
  }
  let angle = Math.atan2(sy, sx) / 4;
  if (Math.abs(angle) <= SNAP_ANGLE) angle = 0;
  const ux = Math.cos(angle);
  const uy = Math.sin(angle);
  const pu = c.map((p) => p.x * ux + p.y * uy).sort((a, b) => a - b);
  const pv = c.map((p) => -p.x * uy + p.y * ux).sort((a, b) => a - b);
  const u0 = (pu[0] + pu[1]) / 2;
  const u1 = (pu[2] + pu[3]) / 2;
  const v0 = (pv[0] + pv[1]) / 2;
  const v1 = (pv[2] + pv[3]) / 2;
  const at = (u: number, v: number) => ({ x: u * ux - v * uy, y: u * uy + v * ux });
  return [at(u0, v0), at(u1, v0), at(u1, v1), at(u0, v1)];
}

// ---------------------------------------------------------------- geometry

/** `n` points evenly spaced along the polyline. */
function resample(pts: Point2D[], n: number): Point2D[] {
  const lens = [0];
  for (let i = 1; i < pts.length; i++) lens.push(lens[i - 1] + dist(pts[i - 1], pts[i]));
  const total = lens[lens.length - 1];
  if (total === 0) return pts.length ? [pts[0]] : [];
  const out: Point2D[] = [];
  let j = 1;
  for (let k = 0; k < n; k++) {
    const target = (k / (n - 1)) * total;
    while (j < pts.length - 1 && lens[j] < target) j++;
    const seg = lens[j] - lens[j - 1] || 1;
    const t = Math.min(1, Math.max(0, (target - lens[j - 1]) / seg));
    out.push({ x: pts[j - 1].x + (pts[j].x - pts[j - 1].x) * t, y: pts[j - 1].y + (pts[j].y - pts[j - 1].y) * t });
  }
  return out;
}

/** How far the path turns at `b` (0 = straight on, π = straight back). */
function turn(a: Point2D, b: Point2D, c: Point2D): number {
  const a1 = Math.atan2(b.y - a.y, b.x - a.x);
  const a2 = Math.atan2(c.y - b.y, c.x - b.x);
  let d = Math.abs(a2 - a1);
  if (d > Math.PI) d = 2 * Math.PI - d;
  return d;
}

function segmentDist(p: Point2D, a: Point2D, b: Point2D): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const l2 = dx * dx + dy * dy;
  const t = l2 ? Math.min(1, Math.max(0, ((p.x - a.x) * dx + (p.y - a.y) * dy) / l2)) : 0;
  return Math.hypot(p.x - a.x - t * dx, p.y - a.y - t * dy);
}

function dist(a: Point2D, b: Point2D): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function mean(pts: Point2D[]): Point2D {
  let x = 0;
  let y = 0;
  for (const p of pts) {
    x += p.x;
    y += p.y;
  }
  return { x: x / pts.length, y: y / pts.length };
}

function diagonal(pts: Point2D[]): number {
  const xs = pts.map((p) => p.x);
  const ys = pts.map((p) => p.y);
  return Math.hypot(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys));
}

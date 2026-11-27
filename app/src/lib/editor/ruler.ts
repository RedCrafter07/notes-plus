import type { Point2D } from "#lib/util/canvasBounds.ts";
import type { Similarity } from "./blocks";

/*
 * The ruler: a straightedge laid over the page. Its position is in page
 * coordinates, so it pans and zooms with the page; its width is constant on
 * screen. A pen stroke that starts on it or next to it runs along the
 * nearer long edge (see `rulerEdge`). It is view state, never saved.
 */

export interface RulerPose {
  center: Point2D;
  /** Direction of its long edges (radians). */
  angle: number;
}

/** A line to draw along: the stroke's centre runs on it. */
export interface EdgeLine {
  origin: Point2D;
  /** Unit vector along the edge. */
  dir: Point2D;
}

/** Width of the ruler on screen (px). */
export const RULER_WIDTH = 72;
/** Length of the ruler on screen (px); longer than any screen. */
export const RULER_LENGTH = 4000;
/** Pen strokes starting this close outside an edge (screen px) also follow it. */
export const EDGE_MARGIN = 24;

/** Turns snap to a multiple of 45° when this close (radians). */
const SNAP = (2 * Math.PI) / 180;

/** `p` in the ruler's frame: `u` along it from the centre, `v` across it. */
export function toRuler(pose: RulerPose, p: Point2D): { u: number; v: number } {
  const dx = p.x - pose.center.x;
  const dy = p.y - pose.center.y;
  const c = Math.cos(pose.angle);
  const s = Math.sin(pose.angle);
  return { u: dx * c + dy * s, v: -dx * s + dy * c };
}

export function hitRuler(pose: RulerPose, p: Point2D, halfWidth: number, halfLength: number): boolean {
  const { u, v } = toRuler(pose, p);
  return Math.abs(u) <= halfLength && Math.abs(v) <= halfWidth;
}

/**
 * The edge a stroke starting at `p` should follow, or none if `p` is not on
 * the ruler or within `margin` of it. The line sits half the stroke's
 * `thickness` outside the edge, so the ink touches the ruler without going
 * under it.
 */
export function rulerEdge(
  pose: RulerPose,
  p: Point2D,
  { halfWidth, halfLength, margin, thickness }: { halfWidth: number; halfLength: number; margin: number; thickness: number },
): EdgeLine | undefined {
  const { u, v } = toRuler(pose, p);
  if (Math.abs(u) > halfLength || Math.abs(v) > halfWidth + margin) return;
  const side = v < 0 ? -1 : 1;
  const offset = side * (halfWidth + thickness / 2);
  const c = Math.cos(pose.angle);
  const s = Math.sin(pose.angle);
  return {
    origin: { x: pose.center.x - s * offset, y: pose.center.y + c * offset },
    dir: { x: c, y: s },
  };
}

/** Position of `p` along the edge (distance from its origin). */
export function along(edge: EdgeLine, p: Point2D): number {
  return (p.x - edge.origin.x) * edge.dir.x + (p.y - edge.origin.y) * edge.dir.y;
}

export function pointOn(edge: EdgeLine, t: number): Point2D {
  return { x: edge.origin.x + edge.dir.x * t, y: edge.origin.y + edge.dir.y * t };
}

/**
 * The ruler after a one- or two-finger gesture that started at `start`:
 * turned about the gesture's start point and moved with it. Scale is
 * ignored: a ruler does not stretch. Snaps to multiples of 45° when close.
 */
export function moveRuler(start: RulerPose, g: Similarity): RulerPose {
  const c = Math.cos(g.angle);
  const s = Math.sin(g.angle);
  const dx = start.center.x - g.from.x;
  const dy = start.center.y - g.from.y;
  const center = { x: g.to.x + dx * c - dy * s, y: g.to.y + dx * s + dy * c };
  const angle = normalize(start.angle + g.angle);
  const snapped = snapAngle(angle);
  if (snapped === angle) return { center, angle };
  // Turn about the gesture's centre, so the snap does not shift the ruler under the fingers.
  return { center: turnAbout(center, g.to, snapped - angle), angle: snapped };
}

export function snapAngle(a: number): number {
  const step = Math.PI / 4;
  const k = Math.round(a / step) * step;
  return Math.abs(a - k) <= SNAP ? normalize(k) : a;
}

/** Angle in (-π, π]. */
export function normalize(a: number): number {
  const t = a % (2 * Math.PI);
  if (t > Math.PI) return t - 2 * Math.PI;
  if (t <= -Math.PI) return t + 2 * Math.PI;
  return t;
}

function turnAbout(p: Point2D, pivot: Point2D, a: number): Point2D {
  const c = Math.cos(a);
  const s = Math.sin(a);
  const dx = p.x - pivot.x;
  const dy = p.y - pivot.y;
  return { x: pivot.x + dx * c - dy * s, y: pivot.y + dx * s + dy * c };
}

/** Angle for display, as a whole number of degrees in 0–179 (a ruler has no direction). */
export function rulerDegrees(angle: number): number {
  const d = Math.round((angle * 180) / Math.PI);
  return ((d % 180) + 180) % 180;
}

import type { Point2D } from "./canvasBounds";

/** Even-odd ray casting: whether `p` lies inside the closed `polygon`. */
export function isPointInPolygon(p: Point2D, polygon: Point2D[]) {
  let isInside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i].x,
      yi = polygon[i].y;
    const xj = polygon[j].x,
      yj = polygon[j].y;

    const intersect =
      yi > p.y !== yj > p.y && p.x < ((xj - xi) * (p.y - yi)) / (yj - yi) + xi;

    if (intersect) isInside = !isInside;
  }

  return isInside;
}

/** Whether segments ab and cd cross or touch. */
export function segmentsIntersect(a: Point2D, b: Point2D, c: Point2D, d: Point2D): boolean {
  const cross = (o: Point2D, p: Point2D, q: Point2D) => (p.x - o.x) * (q.y - o.y) - (p.y - o.y) * (q.x - o.x);
  const d1 = cross(c, d, a);
  const d2 = cross(c, d, b);
  const d3 = cross(a, b, c);
  const d4 = cross(a, b, d);
  if (((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) && ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0))) return true;
  const on = (o: Point2D, p: Point2D, q: Point2D) =>
    Math.min(o.x, p.x) <= q.x && q.x <= Math.max(o.x, p.x) && Math.min(o.y, p.y) <= q.y && q.y <= Math.max(o.y, p.y);
  return (
    (d1 === 0 && on(c, d, a)) || (d2 === 0 && on(c, d, b)) || (d3 === 0 && on(a, b, c)) || (d4 === 0 && on(a, b, d))
  );
}

/**
 * Whether the polyline crosses the edge of the closed `polygon` anywhere.
 * Segments outside the polygon's box are skipped, so a far-away stroke
 * costs one comparison per point.
 */
export function polylineCrossesPolygon(line: Point2D[], polygon: Point2D[]): boolean {
  if (line.length < 2 || polygon.length < 2) return false;
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const p of polygon) {
    if (p.x < minX) minX = p.x;
    if (p.x > maxX) maxX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.y > maxY) maxY = p.y;
  }
  for (let i = 1; i < line.length; i++) {
    const a = line[i - 1];
    const b = line[i];
    if (Math.max(a.x, b.x) < minX || Math.min(a.x, b.x) > maxX || Math.max(a.y, b.y) < minY || Math.min(a.y, b.y) > maxY)
      continue;
    for (let k = 0, j = polygon.length - 1; k < polygon.length; j = k++)
      if (segmentsIntersect(a, b, polygon[j], polygon[k])) return true;
  }
  return false;
}

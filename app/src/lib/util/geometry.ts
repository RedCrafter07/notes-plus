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

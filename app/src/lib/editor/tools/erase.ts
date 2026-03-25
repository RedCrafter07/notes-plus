import type { Point } from "../../tauri/bindings";

export function erase(
  points: Point[],
  eraserCenter: Omit<Point, "pressure">,
  eraserRadius: number,
) {
  const resultingStrokes: Point[][] = [];
  let currentChunk: Point[] = [];

  for (let i = 0; i < points.length - 1; i++) {
    const c = points[i];
    const n = points[i + 1];

    const cInEraser = checkInEraser(c, eraserCenter, eraserRadius);
    const nInEraser = checkInEraser(n, eraserCenter, eraserRadius);

    if (cInEraser && nInEraser) continue;

    const intersections = getIntersections(c, n, eraserCenter, eraserRadius);

    switch (intersections.length) {
      case 0:
        // untouched
        currentChunk.push(c);
        break;
      case 1:
        if (nInEraser) {
          // next point is inside eraser; delete points between c and the intersection with the eraser
          currentChunk.push(c);
          currentChunk.push(intersections[0]);

          resultingStrokes.push(currentChunk);
          currentChunk = [];
        } else if (cInEraser) {
          // current point is inside eraser; push intersection
          currentChunk.push(intersections[0]);
        }
        // both points are in eraser - ignore!
        break;
      case 2:
        //
        currentChunk.push(c);
        currentChunk.push(intersections[0]);
        resultingStrokes.push(currentChunk);
        currentChunk = [];
        currentChunk.push(intersections[1]);
        break;
    }
  }

  const lastPoint = points[points.length - 1];

  if (!checkInEraser(lastPoint, eraserCenter, eraserRadius))
    currentChunk.push(lastPoint);

  resultingStrokes.push(currentChunk);

  return resultingStrokes.filter((s) => s.length > 1);
}

export function checkInEraser(
  p: Point,
  eraser: Omit<Point, "pressure">,
  radius: number,
) {
  return (p.x - eraser.x) ** 2 + (p.y - eraser.y) ** 2 <= radius ** 2;
}

export function getIntersections(
  p1: Point,
  p2: Point,
  eraserCenter: Omit<Point, "pressure">,
  eraserRadius: number,
) {
  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;

  const fx = p1.x - eraserCenter.x;
  const fy = p1.y - eraserCenter.y;

  const a = dx ** 2 + dy ** 2;
  const b = 2 * (fx * dx + fy * dy);
  const c = fx ** 2 + fy ** 2 - eraserRadius ** 2;

  let discriminant = b * b - 4 * a * c;
  if (discriminant < 0) {
    return [];
  }
  discriminant = Math.sqrt(discriminant);

  const t1 = (-b - discriminant) / (2 * a);
  const t2 = (-b + discriminant) / (2 * a);

  const hits = [];

  if (t1 >= 0 && t1 <= 1) hits.push(t1);
  if (t2 >= 0 && t2 <= 1) hits.push(t2);

  return hits.map((t) => {
    return {
      x: p1.x + t * dx,
      y: p1.y + t * dy,
      pressure: p1.pressure + t * ((p2.pressure ?? 0.5) - (p1.pressure ?? 0.5)),
    };
  });
}

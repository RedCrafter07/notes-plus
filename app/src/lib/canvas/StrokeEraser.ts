import type { SimplePoint, Stroke } from "$lib/types/canvas";
import { StrokeBuilder } from "./StrokeBuilder.svelte";

export class StrokeEraser {
  #eraserRadius: number = 15;
  #strokes: Stroke[] = [];

  constructor(radius: number, strokes?: Stroke[]) {
    if (strokes) this.#strokes = strokes;

    this.#eraserRadius = radius;
  }

  public setStrokes(strokes: Stroke[]) {
    this.#strokes = strokes;
  }

  public async getHitIndeces(point: SimplePoint) {
    const hitIndeces: number[] = [];

    for (let i = 0; i < this.#strokes.length; i++) {
      const stroke = this.#strokes[i];

      const strokeBuilder = StrokeBuilder.fromStroke(stroke);

      await strokeBuilder.finalizePath();

      const { points } = strokeBuilder;

      const isHit = points.some((v, i, a) => {
        const distance = pointToSegmentDistance(
          { x: point.x, y: point.y },
          v,
          a[i + 1],
        );

        if (distance > this.#eraserRadius) return false;
        else return true;
      });

      if (isHit) hitIndeces.push(i);
    }

    return hitIndeces;
  }
}

function pointToSegmentDistance(
  eraser: SimplePoint,
  segmentStart: SimplePoint,
  segmentEnd?: SimplePoint,
) {
  if (!segmentEnd) {
    const distance = Math.sqrt(
      (eraser.x - segmentStart.x) ** 2 + (eraser.y - segmentStart.y) ** 2,
    );

    return distance;
  }

  const eraserVector = {
    x: eraser.x - segmentStart.x,
    y: eraser.y - segmentStart.y,
  };
  const segmentVector = {
    x: segmentEnd.x - segmentStart.x,
    y: segmentEnd.y - segmentStart.y,
  };

  const segmentLength = segmentVector.x ** 2 + segmentVector.y ** 2;

  const t = Math.max(
    0,
    Math.min(
      (eraserVector.x * segmentVector.x + eraserVector.y * segmentVector.y) /
        segmentLength,
      1,
    ),
  );

  const closestPoint = {
    x: segmentStart.x + t * segmentVector.x,
    y: segmentStart.y + t * segmentVector.y,
  };

  const distance = Math.sqrt(
    (eraser.x - closestPoint.x) ** 2 + (eraser.y - closestPoint.y) ** 2,
  );

  return distance;
}

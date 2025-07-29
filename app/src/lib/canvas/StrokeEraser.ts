import type { SimplePoint, Stroke } from "$lib/types/canvas";

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

  public getHitIndeces(point: SimplePoint) {
    const hitIndeces: number[] = [];

    for (let i = 0; i < this.#strokes.length; i++) {
      const { points } = this.#strokes[i];

      const isHit = points.some((v) => {
        if (
          Math.abs(point.x - v.x) > this.#eraserRadius &&
          Math.abs(point.y - v.y) > this.#eraserRadius
        )
          return false;

        const distance = Math.sqrt(
          Math.pow(v.x - point.x, 2) + Math.pow(v.y - point.y, 2),
        );

        if (distance > this.#eraserRadius) return false;
        else return true;
      });

      if (isHit) hitIndeces.push(i);
    }

    return hitIndeces;
  }

  public clear() {
    this.#strokes = [];
  }
}

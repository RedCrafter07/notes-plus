import type { SimplePoint } from "$lib/types/canvas";

export class StrokeEraser {
  #eraserRadius: number = 15;
  #strokes: SimplePoint[][] = [];

  public setStrokes(strokes: SimplePoint[][]) {
    this.#strokes = strokes;
  }

  public deleteAt(point: SimplePoint) {
    const indecesToDelete = this.getHitStrokes(point).map((p) => p.i);

    const newStrokes = this.#strokes;

    indecesToDelete.forEach((i) => {
      newStrokes.splice(i, 1);
    });

    return newStrokes;
  }

  private getHitStrokes(point: SimplePoint) {
    const hitStrokes = this.calculateDistanceToStroke(point)
      .map((p, i) => ({ ...p, i }))
      .filter((s) => s.some((p) => p.distance <= this.#eraserRadius));

    return hitStrokes;
  }

  private calculateDistanceToStroke(
    point: SimplePoint,
  ): (SimplePoint & { distance: number })[][] {
    return this.#strokes.map((s) => {
      const pointsWithDistance = s.map(({ x, y }) => {
        const distance = Math.sqrt(
          Math.pow(x - point.x, 2) + Math.pow(y - point.y, 2),
        );

        return { x, y, distance };
      });

      return pointsWithDistance;
    });
  }

  public clear() {
    this.#strokes = [];
  }
}

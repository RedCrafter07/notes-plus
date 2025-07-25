import type { Point } from "./StrokeBuilder.svelte";
export type SimplePoint = Record<"x" | "y", number>;

export class OutlineBuilder {
  #width: number;

  constructor(width: number = 5) {
    this.#width = width;
  }

  get width() {
    return this.#width;
  }

  public generateOutline(points: Point[]) {
    if (points.length <= 1) return [];
    points = this.filterDuplicatePoints(points);

    return this.generatePoints(points);
  }

  private generatePoints(points: Point[]): SimplePoint[] {
    const topOutline: SimplePoint[] = [];
    const bottomOutline: SimplePoint[] = [];

    for (let i = 0; i < points.length - 1; i++) {
      const p1 = points[i];
      const p2 = points[i + 1];

      const velocity = { x: p2.x - p1.x, y: p2.y - p1.y };
      const perpendicular = { x: -velocity.y, y: velocity.x };

      const widthPerSide = this.#width * p1.pressure;

      const distance = Math.sqrt(velocity.x ** 2 + velocity.y ** 2);
      const normalized = {
        x: perpendicular.x / distance,
        y: perpendicular.y / distance,
      };

      topOutline.push({
        x: p1.x - normalized.x * widthPerSide,
        y: p1.y - normalized.y * widthPerSide,
      });
      bottomOutline.push({
        x: p1.x + normalized.x * widthPerSide,
        y: p1.y + normalized.y * widthPerSide,
      });
    }

    return [...topOutline, ...bottomOutline.reverse(), topOutline[0]];
  }

  private filterDuplicatePoints(
    points: Point[],
    threshold: number = 0.1,
  ): Point[] {
    const filtered = [points[0]];

    for (let i = 1; i < points.length; i++) {
      const current = points[i];
      const previous = filtered[filtered.length - 1];

      if (this.distance(current, previous) > threshold) {
        filtered.push(current);
      }
    }

    return filtered;
  }

  private distance(p1: Point, p2: Point): number {
    return Math.sqrt((p2.x - p1.x) ** 2 + (p2.y - p1.y) ** 2);
  }
}

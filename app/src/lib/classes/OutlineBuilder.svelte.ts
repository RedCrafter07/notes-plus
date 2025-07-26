import type { Point } from "./StrokeBuilder.svelte";
export type SimplePoint = Record<"x" | "y", number>;

export class OutlineBuilder {
  #width: number;
  #normalsCache: SimplePoint[] = [];
  #points: Point[] = [];

  #previewOutlines: string[] = $state([]);

  constructor(width: number = 5) {
    this.#width = width;
  }

  get width() {
    return this.#width;
  }

  get previewOutlines() {
    return this.#previewOutlines;
  }

  set width(input: number) {
    this.#width = input;
  }

  public addNewPoints(points: Point[]) {
    const newPointCount = points.length - this.#points.length;
    this.#points.push(...points.slice(-newPointCount));

    this.revalidateNormalsCache(newPointCount, true);
    this.generatePreviewOutlines();
  }

  public generatePreviewOutlines(): { x: number; y: number }[][] {
    let points = [];
    for (let i = 0; i < this.#normalsCache.length; i++) {
      const current = this.#normalsCache[i];
      const p = this.#points[i];

      const width = this.#width * p.pressure;

      const result = [
        { x: p.x - current.x * width, y: p.y - current.y * width },
        { x: p.x + current.x * width, y: p.y + current.y * width },
      ];

      points.push(result);
    }

    const connection = points.reduce(
      (p, current, i) => {
        if (i < 1) return p;
        const sliceCount = Math.min(20, i);

        const slices = [current];

        for (let j = 1; j <= sliceCount; j++) {
          slices.push(points[i - j]);
        }

        const newPoints = slices.reduce((p, c) => {
          const [p1, p2] = c;

          p.unshift(p1);
          p.push(p2);

          return p;
        }, []);

        p.push(newPoints);
        return p;
      },
      [] as { x: number; y: number }[][],
    );

    return connection;
  }

  private revalidateNormalsCache(amount: number = 5, append: boolean = false) {
    const points = this.#points.slice(-amount - 1);
    const normals: SimplePoint[] = [];

    for (let i = 0; i < points.length - 1; i++) {
      const p1 = points[i];
      const p2 = points[i + 1];

      const velocity = { x: p2.x - p1.x, y: p2.y - p1.y };
      const perpendicular = { x: -velocity.y, y: velocity.x };

      const distance = Math.sqrt(velocity.x ** 2 + velocity.y ** 2);
      const normalized = {
        x: perpendicular.x / distance,
        y: perpendicular.y / distance,
      };

      normals.push(normalized);
    }

    if (append) this.#normalsCache.push(...normals);
    else this.#normalsCache.splice(-amount, amount, ...normals);
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

  public clear() {
    this.#normalsCache = [];
    this.#points = [];
  }
}

import { OutlineBuilder, type SimplePoint } from "./OutlineBuilder.svelte";

export type Point = Record<"x" | "y" | "pressure", number>;

export class StrokeBuilder {
  #points = $state<Point[]>([]);
  #width: number;
  #immediatePath = $state("");
  #optimizedPath = $state<string | null>(null);
  #isOptimizing = $state(false);
  #isOptimized = $state(false);
  #lastPoint: Point | undefined = undefined;
  #outlineBuilder = new OutlineBuilder(20);

  constructor(width: number = 5) {
    this.#width = width;
  }

  public addPoint(x: number, y: number, pressure: number) {
    if (this.#lastPoint) {
      const distance = Math.sqrt(
        Math.pow(x - this.#lastPoint.x, 2) + Math.pow(y - this.#lastPoint.y, 2),
      );

      if (distance < 5) return;
    }
    this.#points.push(this.smoothPoints({ x, y, pressure }));
    this.#immediatePath = this.buildImmediatePath();

    this.#isOptimized = false;
  }

  public get immediatePath() {
    return this.#immediatePath;
  }
  public get optimizedPath() {
    return this.#optimizedPath;
  }
  public get isOptimizing() {
    return this.#isOptimizing;
  }
  public get points() {
    return this.#points;
  }
  public get isOptimized() {
    return this.#isOptimized;
  }

  private smoothPoints(current: Point): Point {
    const previous = this.#lastPoint;
    this.#lastPoint = current;
    if (!previous) return current;
    const predictionStrength = 0.2;
    const smoothingFactor = 0.4;

    const predicted = {
      x: current.x + (current.x - previous.x) * predictionStrength,
      y: current.y + (current.y - previous.y) * predictionStrength,
    };

    const smoothed = {
      x: previous.x * smoothingFactor + predicted.x * (1 - smoothingFactor),
      y: previous.y * smoothingFactor + predicted.y * (1 - smoothingFactor),
    };

    return { ...smoothed, pressure: current.pressure };
  }

  private buildImmediatePath() {
    return this.buildQuadraticBezierPath();
  }

  private buildSimplePath(): string {
    let path = "";
    const points = this.#points;

    for (let i = 0; i < points.length; i++) {
      const point = points[i];

      if (i === 0) path += "M";
      else path += "L";

      path += `${point.x},${point.y} `;
    }

    return path;
  }
  private buildQuadraticBezierPath(
    connectLastPoint: boolean = false,
    points: SimplePoint[] = this.#points,
  ): string {
    if (points.length < 3) return this.buildSimplePath();

    let path = `M${points[0].x},${this.#points[0].y}`;

    for (let i = 1; i < points.length - 1; i++) {
      const current = points[i];
      const next = points[i + 1];
      const midPoint = {
        x: (current.x + next.x) / 2,
        y: (current.y + next.y) / 2,
      };

      if (i === points.length - 1) path += ` L${next.x},${next.y}`;
      else path += ` Q${current.x},${current.y} ${midPoint.x},${midPoint.y}`;
    }

    return path;
  }

  private buildOptimizedPath(): string {
    this.#points = this.chaikinSmooth(2);

    return this.buildQuadraticBezierPath(
      true,
      this.#outlineBuilder.generateOutline(this.#points),
    );
  }

  public finalizePath() {
    return new Promise<string>((resolve) => {
      this.#optimizedPath = this.buildOptimizedPath();
      this.#isOptimizing = false;
      this.#isOptimized = true;
      resolve(this.#optimizedPath);
    });
  }

  private chaikinSmooth(iter: number = 2, points?: Point[]) {
    let currentPoints = points ? points : this.#points;

    for (let i = 0; i < iter; i++) {
      currentPoints = chaikinSmooth(currentPoints);
    }

    return currentPoints;
  }

  public clear() {
    this.#points = [];
    this.#immediatePath = "";
    this.#optimizedPath = null;
    this.#isOptimized = false;
    this.#isOptimizing = false;
    this.#lastPoint = undefined;
  }

  private calculateOutline() {}
}

function chaikinSmooth(points: Point[]): Point[] {
  if (points.length < 3) return points;

  const result: Point[] = [];

  result.push(points[0]);

  for (let i = 0; i < points.length - 1; i++) {
    const p1 = points[i];
    const p2 = points[i + 1];

    result.push({
      x: 0.75 * p1.x + 0.25 * p2.x,
      y: 0.75 * p1.y + 0.25 * p2.y,
      pressure: (p1.pressure + p2.pressure) / 2.0,
    });

    result.push({
      x: 0.25 * p1.x + 0.75 * p2.x,
      y: 0.25 * p1.y + 0.75 * p2.y,
      pressure: (p1.pressure + p2.pressure) / 2.0,
    });
  }

  result.push(points[points.length - 1]);

  return result;
}

import { OutlineBuilder } from "./OutlineBuilder.svelte";
import type { Point, SimplePoint } from "$lib/types/canvas";
import type { StrokeBlock } from "$lib/types/bindings/StrokeBlock";

export class StrokeBuilder {
  #points = $state<Point[]>([]);
  #immediatePath = $state("");
  #optimizedPath = $state<string | null>(null);
  #isOptimized = $state(false);
  #lastPoint: Point | undefined = undefined;
  #outlineBuilder = new OutlineBuilder(5);

  #lastPreviewTime: number = 0;
  #previewUpdateScheduled: boolean = false;
  #previewDirty: boolean = true;
  #cachedPreviewPaths: string[] = [];

  color: string = $state<string>("#ffffff");

  constructor(width: number = 5, color: string = "#ffffff") {
    this.#outlineBuilder.width = width;
    this.color = color;
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
    this.#outlineBuilder.addNewPoints(this.#points);

    const now = performance.now();

    this.#previewDirty = true;

    if (now - this.#lastPreviewTime > 10) {
      this.updatePreviewPaths();
      this.#lastPreviewTime = now;
    } else if (!this.#previewUpdateScheduled) {
      this.#previewUpdateScheduled = true;
      requestAnimationFrame(() => {
        this.updatePreviewPaths();
        this.#lastPreviewTime = now;
        this.#previewUpdateScheduled = false;
      });
    }
  }

  private updatePreviewPaths() {
    if (!this.#previewDirty) return;

    this.#cachedPreviewPaths = this.generatePreviewPaths();
    this.#previewDirty = false;
  }

  private generatePreviewPaths(): string[] {
    const currentOutline = this.generateSimplePreview();
    return [currentOutline];
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

  public get previewPaths() {
    return this.#cachedPreviewPaths;
  }

  private generateSimplePreview(): string {
    const smoothedPoints = this.applySmoothingToPoints(this.#points, 2);
    const outlinePoints =
      this.#outlineBuilder.generateFinalOutline(smoothedPoints);
    return buildGentleCurves(outlinePoints, 0.12);
  }

  private buildImmediatePath() {
    return buildQuadraticBezierPath(false, this.#points);
  }

  public finalizePath() {
    return new Promise<string>((resolve) => {
      // Apply more smoothing for final result
      const smoothedPoints = this.applySmoothingToPoints(this.#points, 2); // 2 iterations
      const finalOutline =
        this.#outlineBuilder.generateFinalOutline(smoothedPoints);

      this.#optimizedPath = this.buildConsistentPath(finalOutline, false);

      this.#isOptimized = true;
      resolve(this.#optimizedPath);
    });
  }

  private buildConsistentPath(
    points: SimplePoint[],
    isPreview: boolean,
  ): string {
    if (points.length < 4) return buildSimplePath(points);

    const smoothingStrength = isPreview ? 0.08 : 0.12; // Slightly more smoothing for final
    return buildGentleCurves(points, smoothingStrength);
  }

  private applySmoothingToPoints(points: Point[], iterations: number): Point[] {
    let result = [...points];
    for (let i = 0; i < iterations; i++) {
      result = chaikinSmooth(result);
    }
    return result;
  }

  public toStroke(): StrokeBlock {
    const data: StrokeBlock = {
      id: crypto.randomUUID(),
      width: this.#outlineBuilder.width,
      points: [...this.#points],
      color: this.color,
    };

    return data;
  }

  public static fromStroke(input: StrokeBlock): StrokeBuilder {
    const { color, points, width } = input;
    const newBuilder = new StrokeBuilder(width, color);
    newBuilder.points = points;

    return newBuilder;
  }

  public clear() {
    this.#points = [];
    this.#immediatePath = "";
    this.#optimizedPath = null;
    this.#isOptimized = false;
    this.#lastPoint = undefined;
    this.#outlineBuilder.clear();
  }

  // Getters
  public get immediatePath() {
    return this.#immediatePath;
  }
  public get optimizedPath() {
    return this.#optimizedPath;
  }
  public get isOptimized() {
    return this.#isOptimized;
  }
  public get points() {
    return this.#points;
  }
  public get width() {
    return this.#outlineBuilder.width;
  }
  public set width(value: number) {
    this.#outlineBuilder.width = value;
  }

  public set points(input: Point[]) {
    this.#points = input;

    this.#previewDirty = true;
    this.updatePreviewPaths();
  }
}

function buildGentleCurves(
  points: SimplePoint[],
  smoothingStrength: number,
): string {
  if (points.length < 4) return buildSimplePath(points);

  let path = `M${points[0].x},${points[0].y}`;

  for (let i = 1; i < points.length - 1; i++) {
    const prev = points[i - 1];
    const current = points[i];
    const next = points[i + 1];

    // Calculate very gentle control point
    const controlPoint = {
      x: current.x + (current.x - (prev.x + next.x) / 2) * smoothingStrength,
      y: current.y + (current.y - (prev.y + next.y) / 2) * smoothingStrength,
    };

    path += ` Q${controlPoint.x},${controlPoint.y} ${current.x},${current.y}`;
  }

  const lastPoint = points[points.length - 1];
  path += ` L${lastPoint.x},${lastPoint.y}`;

  // Close if it looks like a closed shape
  if (isClosedShape(points)) {
    path += " Z";
  }

  return path;
}

function isClosedShape(points: SimplePoint[]): boolean {
  if (points.length < 4) return false;
  const first = points[0];
  const last = points[points.length - 1];
  const distance = Math.sqrt((first.x - last.x) ** 2 + (first.y - last.y) ** 2);
  return distance < 10;
}

function buildSimplePath(points: SimplePoint[]): string {
  if (points.length === 0) return "";

  let path = `M${points[0].x},${points[0].y}`;
  for (let i = 1; i < points.length; i++) {
    path += ` L${points[i].x},${points[i].y}`;
  }
  return path;
}

function buildQuadraticBezierPath(
  connectLastPoint: boolean,
  points: SimplePoint[],
): string {
  if (points.length < 3) return buildSimplePath(points);

  let path = `M${points[0].x},${points[0].y}`;
  const subtractionAmount = connectLastPoint ? 2 : 1;

  for (let i = 1; i < points.length - subtractionAmount; i++) {
    const current = points[i];
    const next = points[i + 1];
    const midPoint = {
      x: (current.x + next.x) / 2,
      y: (current.y + next.y) / 2,
    };
    path += ` Q${current.x},${current.y} ${midPoint.x},${midPoint.y}`;
  }

  if (connectLastPoint) path += " Z";
  return path;
}

function chaikinSmooth(points: Point[]): Point[] {
  if (points.length < 3) return points;
  const result: Point[] = [points[0]];

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

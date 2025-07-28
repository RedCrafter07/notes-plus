import type { SimplePoint, Point } from "$lib/types/canvas";

export class OutlineBuilder {
  #width: number;
  #points: Point[] = [];
  #consolidatedPoints: SimplePoint[] = [];
  #consolidatedUntil: number = 0;
  #recentOutline: SimplePoint[] = $state([]);

  private static CONSOLIDATION_THRESHOLD = 40;
  private static CONSOLIDATE_EVERY = 25;

  constructor(width: number = 5) {
    this.#width = width;
  }

  public addNewPoints(points: Point[]) {
    const newPointCount = points.length - this.#points.length;
    this.#points.push(...points.slice(-newPointCount));

    this.checkConsolidation();
    this.updateRecentOutline();
  }

  private checkConsolidation() {
    const totalPoints = this.#points.length;
    const unconsolidatedCount = totalPoints - this.#consolidatedUntil;

    if (
      totalPoints > OutlineBuilder.CONSOLIDATION_THRESHOLD &&
      unconsolidatedCount >= OutlineBuilder.CONSOLIDATE_EVERY
    ) {
      this.consolidate();
    }
  }

  private consolidate() {
    const leaveForPreview = 8;
    const consolidateUpTo = Math.max(
      this.#consolidatedUntil,
      this.#points.length - leaveForPreview,
    );

    if (consolidateUpTo <= this.#consolidatedUntil) return;

    const pointsToConsolidate = this.#points.slice(0, consolidateUpTo);
    this.#consolidatedPoints = this.generateOutlinePoints(pointsToConsolidate);
    this.#consolidatedUntil = consolidateUpTo;
  }

  private updateRecentOutline() {
    const overlapSize = 3;
    const startIndex = Math.max(0, this.#consolidatedUntil - overlapSize);
    const recentPoints = this.#points.slice(startIndex);

    if (recentPoints.length >= 3) {
      this.#recentOutline = this.generateOutlinePoints(recentPoints);
    } else {
      this.#recentOutline = [];
    }
  }

  public getJoinedOutlines(): {
    consolidated: SimplePoint[];
    recent: SimplePoint[];
  } {
    return {
      consolidated: this.#consolidatedPoints,
      recent: this.#recentOutline,
    };
  }

  public generateFinalOutline(smoothedPoints: Point[]): SimplePoint[] {
    return this.generateOutlinePoints(smoothedPoints);
  }

  private generateOutlinePoints(points: Point[]): SimplePoint[] {
    if (points.length <= 1) return [];

    points = this.filterDuplicatePoints(points);
    if (points.length <= 1) return [];

    const topOutline: SimplePoint[] = [];
    const bottomOutline: SimplePoint[] = [];

    for (let i = 0; i < points.length - 1; i++) {
      const p1 = points[i];
      const p2 = points[i + 1];

      const velocity = { x: p2.x - p1.x, y: p2.y - p1.y };
      const distance = Math.sqrt(velocity.x ** 2 + velocity.y ** 2);

      if (distance === 0) continue; // Skip zero-length segments

      const perpendicular = { x: -velocity.y, y: velocity.x };
      const widthPerSide = this.#width * p1.pressure;

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

    return [...topOutline, ...bottomOutline.reverse()];
  }

  private filterDuplicatePoints(
    points: Point[],
    threshold: number = 0.1,
  ): Point[] {
    if (points.length === 0) return [];

    const filtered = [points[0]];
    for (let i = 1; i < points.length; i++) {
      const current = points[i];
      const previous = filtered[filtered.length - 1];

      const distance = Math.sqrt(
        (current.x - previous.x) ** 2 + (current.y - previous.y) ** 2,
      );

      if (distance > threshold) {
        filtered.push(current);
      }
    }
    return filtered;
  }

  public clear() {
    this.#points = [];
    this.#consolidatedPoints = [];
    this.#consolidatedUntil = 0;
    this.#recentOutline = [];
  }

  get width() {
    return this.#width;
  }
  set width(n: number) {
    this.#width = n;
  }
}

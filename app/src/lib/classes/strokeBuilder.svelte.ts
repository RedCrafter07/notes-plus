export class StrokeBuilder {
  #points = $state<Record<"x" | "y" | "pressure", number>[]>([]);
  #width: number;

  constructor(width: number = 5) {
    this.#width = width;
  }

  public addPoint(x: number, y: number, pressure: number) {
    this.#points.push({ x, y, pressure });
  }

  public get points() {
    return this.#points;
  }

  public get path() {
    return this.buildPath(this.#points);
  }

  private buildPath(points: { x: number; y: number }[]): string {
    let path = "";

    for (let i = 0; i < points.length; i++) {
      const point = points[i];

      if (i === 0) path += "M";
      else path += "L";

      path += `${point.x},${point.y} `;
    }

    return path;
  }

  public finalizePath() {}
  public clear() {
    this.#points = [];
  }

  private calculateOutline() {}
}

export class InputThrottler {
  pendingUpdate: boolean = false;

  update(callback: () => void) {
    this.pendingUpdate = true;
    requestAnimationFrame(() => {
      callback();
      this.pendingUpdate = false;
    });
  }
}

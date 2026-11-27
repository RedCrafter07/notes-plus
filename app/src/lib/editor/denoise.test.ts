import { describe, expect, it } from "vitest";
import type { Point } from "#lib/tauri/bindings.ts";
import { denoise, gridStep } from "./denoise";

const Q = 2 / 3; // one device pixel at 150 %, in CSS px

/** A gentle arc sampled the way the pen arrives: rounded to the pixel grid. */
const staircase: Point[] = Array.from({ length: 80 }, (_, i) => {
  const t = i / 79;
  const x = t * 60;
  const y = Math.sin(t * Math.PI) * 15;
  return { x: Math.round(x / Q) * Q, y: Math.round(y / Q) * Q, pressure: 0.5 };
});

/** Median change of direction per point, in degrees. */
function medianTurn(p: Point[]): number {
  const turns: number[] = [];
  for (let i = 1; i < p.length - 1; i++) {
    const a = Math.atan2(p[i].y - p[i - 1].y, p[i].x - p[i - 1].x);
    const b = Math.atan2(p[i + 1].y - p[i].y, p[i + 1].x - p[i].x);
    let d = Math.abs(b - a);
    if (d > Math.PI) d = 2 * Math.PI - d;
    turns.push((d * 180) / Math.PI);
  }
  turns.sort((x, y) => x - y);
  return turns[Math.floor(turns.length / 2)];
}

describe("denoise", () => {
  it("finds the pixel grid of the input", () => {
    expect(gridStep(staircase)).toBeCloseTo(Q, 6);
  });

  it("turns a pixel staircase into a much straighter line", () => {
    const before = medianTurn(staircase);
    const after = medianTurn(denoise(staircase));
    expect(before).toBeGreaterThan(10);
    expect(after).toBeLessThan(before / 3);
  });

  it("keeps both ends where they are", () => {
    const out = denoise(staircase);
    expect(out[0]).toEqual(staircase[0]);
    expect(out.at(-1)).toEqual(staircase.at(-1));
  });

  it("barely moves precise input, which has no staircase", () => {
    const precise: Point[] = staircase.map((_, i) => {
      const t = i / 79;
      return { x: t * 60 + 0.0123 * i, y: Math.sin(t * Math.PI) * 15, pressure: 0.5 };
    });
    const out = denoise(precise);
    const moved = Math.max(...out.map((p, i) => Math.hypot(p.x - precise[i].x, p.y - precise[i].y)));
    expect(moved).toBeLessThan(0.05);
  });

  it("leaves dots and two-point strokes alone", () => {
    const dot = [{ x: 1, y: 1, pressure: 0.5 }];
    const two = [...dot, { x: 3, y: 1, pressure: 0.5 }];
    expect(denoise(dot)).toBe(dot);
    expect(denoise(two)).toBe(two);
  });
});

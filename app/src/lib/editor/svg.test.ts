import { describe, expect, it } from "vitest";
import type { Point, Stroke } from "#lib/tauri/bindings.ts";
import { centerLine, inputToPath, strokeToPath } from "./svg";

// A curvy, unevenly sampled stroke, like fast handwriting.
const raw: Point[] = Array.from({ length: 40 }, (_, i) => ({
  x: i * 7 + (i % 3) * 2,
  y: Math.sin(i / 3) * 30,
  pressure: 0.5,
}));

const stroke = (points: Point[], smoothed: boolean): Stroke => ({
  id: "s",
  points,
  color: "#000",
  thickness: 4,
  opacity: 1,
  smoothed,
});

describe("smoothed strokes", () => {
  it("draw their centre line exactly like the raw input", () => {
    const line = centerLine(raw, 4);
    expect(strokeToPath(stroke(line, true))).toBe(inputToPath(raw, 4, false));
  });

  it("are not smoothed again (a piece keeps its points)", () => {
    const line = centerLine(raw, 4);
    // Re-smoothing would move the points; drawing as-is must not.
    expect(centerLine(line, 4)).not.toEqual(line);
    expect(strokeToPath(stroke(line, true))).not.toBe(inputToPath(line, 4, false));
  });
});

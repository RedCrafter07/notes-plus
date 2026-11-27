import { describe, expect, it } from "vitest";
import type { Point, Stroke } from "#lib/tauri/bindings.ts";
import { centerLine, inputToPath, strokeToPath } from "./svg";
import { formatSize } from "#lib/util/format.ts";

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

describe("pressure", () => {
  it("leaves a mouse stroke (constant 0.5) exactly as wide as without it", () => {
    expect(inputToPath(raw, 4, false, 0.65)).toBe(inputToPath(raw, 4, false, 0));
  });

  it("changes a pen stroke's outline when the pressure varies", () => {
    const pressed = raw.map((p, i) => ({ ...p, pressure: i < 20 ? 0.15 : 0.95 }));
    expect(inputToPath(pressed, 4, false, 0.65)).not.toBe(inputToPath(pressed, 4, false, 0));
  });
});

describe("formatSize", () => {
  it("shows whole sizes plainly and half sizes with one decimal", () => {
    expect(formatSize(4)).toBe("4");
    expect(formatSize(2.5)).toBe("2.5");
  });
});

describe("smoothed strokes", () => {
  it("draw their centre line exactly like the raw input", () => {
    const line = centerLine(raw, 4);
    expect(strokeToPath(stroke(line, true))).toBe(inputToPath(raw, 4, false));
  });

  it("keep their outline with pressure, too", () => {
    const pressed = raw.map((p, i) => ({ ...p, pressure: 0.2 + 0.6 * Math.sin(i / 8) ** 2 }));
    const line = centerLine(pressed, 4);
    expect(strokeToPath({ ...stroke(line, true), thinning: 0.65 })).toBe(
      inputToPath(pressed, 4, false, 0.65),
    );
  });

  it("are not smoothed again (a piece keeps its points)", () => {
    const line = centerLine(raw, 4);
    // Re-smoothing would move the points; drawing as-is must not.
    expect(centerLine(line, 4)).not.toEqual(line);
    expect(strokeToPath(stroke(line, true))).not.toBe(inputToPath(line, 4, false));
  });
});

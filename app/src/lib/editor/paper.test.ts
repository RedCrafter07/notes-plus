import { describe, expect, it } from "vitest";
import { lineCopies, paperGuides, paperTile, SQRT3 } from "./paper";

describe("paper patterns", () => {
  it("ruled patterns share the lines tile", () => {
    for (const p of ["Lines", "Cornell", "Margin"] as const) expect(paperTile(p, 24)?.rules).toEqual([0]);
    expect(paperTile(null, 24)).toBeNull();
    expect(paperTile("Lines", 0)).toBeNull();
  });

  it("staff paper: five lines s/3 apart, one staff every 4s", () => {
    const t = paperTile("Staff", 24)!;
    expect(t.height).toBe(96);
    expect(t.rules).toEqual([24, 32, 40, 48, 56]);
  });

  it("isometric: its ±60° lines pass through the lattice points", () => {
    const s = 30;
    const t = paperTile("Isometric", s)!;
    const h = s * SQRT3;
    expect(t.height).toBeCloseTo(h);
    const onLine = ([x1, y1, x2, y2]: number[], x: number, y: number) =>
      Math.abs((x2 - x1) * (y - y1) - (y2 - y1) * (x - x1)) < 1e-6 * Math.hypot(x2 - x1, y2 - y1) * 10;
    for (const [x, y] of [
      [0, h / 4],
      [s / 2, (3 * h) / 4],
      [s, h / 4],
    ])
      expect(lineCopies(t).filter((l) => onLine(l, x, y)).length).toBe(2);
    // Each line runs at 60° or 120° (which is -60° for a line), never level.
    for (const [x1, y1, x2, y2] of lineCopies(t))
      expect(Math.abs(Math.abs((y2 - y1) / (x2 - x1)) - SQRT3)).toBeLessThan(1e-9);
  });

  it("guides sit relative to the page, and not on infinite pages", () => {
    const a4 = { width: 794, height: 1123 };
    expect(paperGuides({ ...a4, pattern: "Margin" })).toEqual([{ x1: 95, y1: 0, x2: 95, y2: 1123, color: "#e5848e", weight: 1.5 }]);
    expect(paperGuides({ ...a4, pattern: "Cornell" })).toHaveLength(2);
    expect(paperGuides({ width: -1, height: -1, pattern: "Cornell" })).toEqual([]);
    expect(paperGuides({ ...a4, pattern: "Lines" })).toEqual([]);
  });
});

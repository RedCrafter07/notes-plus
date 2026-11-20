import { describe, expect, test } from "vitest";
import { boundsFromRect } from "$lib/util/canvasBounds";
import { coverContent, move, nextRegion, nominalSize, reshape, resetScale } from "./regions";

describe("export regions", () => {
  test("first region starts at the anchor at 100% A4", () => {
    const r = nextRegion([], boundsFromRect(10, 20, 5, 5), 1);
    expect([r.x, r.y]).toEqual([10, 20]);
    expect([r.width, r.height]).toEqual([794, 1123]);
    expect(r.name).toBe("Region 1");
  });

  test("next region goes to the right of the last one, same format", () => {
    const a = { ...nextRegion([], null, 1), format: "16:9", orientation: "landscape" as const };
    const b = nextRegion([a], null, 2);
    expect(b.x).toBe(a.x + a.width + 40);
    expect(b.format).toBe("16:9");
  });

  test("reshape between fixed formats keeps centre and scale", () => {
    const a = { ...nextRegion([], null, 1), width: 794 * 2, height: 1123 * 2 };
    const l = reshape(a, "a4", "landscape");
    expect(l.width).toBeCloseTo(1123 * 2);
    expect(l.x + l.width / 2).toBeCloseTo(a.x + a.width / 2);
    expect(nominalSize(l).width).toBe(1123);
  });

  test("free regions keep their shape and export at their own size", () => {
    const a = { ...nextRegion([], null, 1), width: 300, height: 120 };
    const free = reshape(a, "free", a.orientation);
    expect([free.width, free.height]).toEqual([300, 120]);
    expect(nominalSize(free)).toEqual({ width: 300, height: 120 });
    expect(resetScale(free)).toEqual(free);

    // Back to A4: keeps the width, takes A4's ratio.
    const a4 = reshape(free, "a4", "portrait");
    expect(a4.width).toBeCloseTo(300);
    expect(a4.height).toBeCloseTo((300 * 1123) / 794);
  });

  test("cover content skips empty tiles, in reading order", () => {
    const content = boundsFromRect(0, 0, 1500, 1000);
    const ink = [boundsFromRect(1400, 500, 50, 50)];
    const regions = coverContent(content, ink, "a4", "portrait");
    expect(regions).toHaveLength(1);
    expect(regions[0].x).toBeGreaterThan(0);
  });

  test("move reorders and clamps", () => {
    expect(move([1, 2, 3], 0, 2)).toEqual([2, 3, 1]);
    expect(move([1, 2, 3], 2, -5)).toEqual([3, 1, 2]);
  });
});

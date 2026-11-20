import { describe, expect, test } from "vitest";
import { boundsFromRect } from "$lib/util/canvasBounds";
import { coverContent, move, nextRegion, nominalSize, reshape } from "./regions";

describe("export regions", () => {
  test("first region starts at the anchor at 100% A4", () => {
    const r = nextRegion([], 0, boundsFromRect(10, 20, 5, 5));
    expect([r.x, r.y]).toEqual([10, 20]);
    expect([r.width, r.height]).toEqual([794, 1123]);
  });

  test("next region goes to the right of the last one", () => {
    const a = nextRegion([], 0, null);
    const b = nextRegion([a], 0, null);
    expect(b.x).toBe(a.x + a.width + 40);
    expect(b.y).toBe(a.y);
  });

  test("reshape keeps centre and scale", () => {
    const a = { ...nextRegion([], 0, null), width: 794 * 2, height: 1123 * 2 };
    const l = reshape(a, "a4", "landscape");
    expect(l.width).toBeCloseTo(1123 * 2);
    expect(l.x + l.width / 2).toBeCloseTo(a.x + a.width / 2);
    expect(nominalSize(l).width).toBe(1123);
  });

  test("cover content skips empty tiles, in reading order", () => {
    // Content spans two A4 columns but only the right one has ink.
    const content = boundsFromRect(0, 0, 1500, 1000);
    const ink = [boundsFromRect(1400, 500, 50, 50)];
    const regions = coverContent(content, ink, 0, "a4", "portrait");
    expect(regions).toHaveLength(1);
    expect(regions[0].x).toBeGreaterThan(0);
  });

  test("move reorders and clamps", () => {
    expect(move([1, 2, 3], 0, 2)).toEqual([2, 3, 1]);
    expect(move([1, 2, 3], 2, -5)).toEqual([3, 1, 2]);
  });
});

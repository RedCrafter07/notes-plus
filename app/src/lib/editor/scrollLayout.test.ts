import { describe, expect, it } from "vitest";
import { columnBounds, columnLayout, offsetFrom, PAGE_GAP, pageAtPoint, pageAtY } from "./scrollLayout";

const a4 = { width: 794, height: 1123 };
const a5 = { width: 559, height: 794 };
const slots = columnLayout([a4, a5, a4])!;

describe("scroll layout", () => {
  it("stacks pages centred, with a gap", () => {
    expect(slots.map((s) => s.y)).toEqual([0, 1123 + PAGE_GAP, 1123 + 794 + 2 * PAGE_GAP]);
    expect(slots[1].x + slots[1].width / 2).toBe(0);
    expect(columnLayout([a4, { width: -1, height: -1 }])).toBeNull();
  });

  it("gives other pages' offsets in the current page's coordinates", () => {
    // The A5 below an A4: centred, so shifted right by half the difference.
    expect(offsetFrom(slots, 0, 1)).toEqual({ x: (794 - 559) / 2, y: 1123 + PAGE_GAP });
    expect(offsetFrom(slots, 1, 0)).toEqual({ x: -(794 - 559) / 2, y: -(1123 + PAGE_GAP) });
    // Round trip: going there and back is no move at all.
    const there = offsetFrom(slots, 0, 2);
    const back = offsetFrom(slots, 2, 0);
    expect(there.x + back.x).toBe(0);
    expect(there.y + back.y).toBe(0);
  });

  it("finds the page owning a height, splitting gaps in the middle", () => {
    expect(pageAtY(slots, 0, 500)).toBe(0);
    expect(pageAtY(slots, 0, 1123 + PAGE_GAP / 2 - 1)).toBe(0);
    expect(pageAtY(slots, 0, 1123 + PAGE_GAP / 2 + 1)).toBe(1);
    expect(pageAtY(slots, 1, -10)).toBe(1); // in its own half of the gap
    expect(pageAtY(slots, 1, -20)).toBe(0); // past it: the page above
    expect(pageAtY(slots, 0, -500)).toBe(0);
    expect(pageAtY(slots, 0, 99999)).toBe(2);
  });

  it("finds the page under a point, not in gaps or beside it", () => {
    const below = offsetFrom(slots, 0, 1);
    expect(pageAtPoint(slots, 0, { x: below.x + 10, y: below.y + 10 })).toBe(1);
    expect(pageAtPoint(slots, 0, { x: 400, y: 1123 + PAGE_GAP / 2 })).toBeUndefined();
    expect(pageAtPoint(slots, 0, { x: -50, y: 10 })).toBeUndefined();
  });

  it("measures the whole column from the current page", () => {
    const b = columnBounds(slots, 1);
    expect(b.top).toBe(-(1123 + PAGE_GAP));
    expect(b.left).toBe(-(794 - 559) / 2);
    expect(b.bottom - b.top).toBe(1123 * 2 + 794 + 2 * PAGE_GAP);
  });
});

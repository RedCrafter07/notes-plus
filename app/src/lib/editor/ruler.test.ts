import { describe, expect, it } from "vitest";
import { along, hitRuler, moveRuler, pointOn, rulerDegrees, rulerEdge, snapAngle, type RulerPose } from "./ruler";

const level: RulerPose = { center: { x: 100, y: 100 }, angle: 0 };
const opts = { halfWidth: 10, halfLength: 200, margin: 5, thickness: 2 };

describe("rulerEdge", () => {
  it("follows the nearer edge, just outside it", () => {
    const below = rulerEdge(level, { x: 120, y: 107 }, opts);
    expect(below?.origin.y).toBeCloseTo(111);
    const above = rulerEdge(level, { x: 120, y: 88 }, opts);
    expect(above?.origin.y).toBeCloseTo(89);
    expect(above?.dir).toEqual({ x: 1, y: 0 });
  });

  it("ignores strokes away from the ruler", () => {
    expect(rulerEdge(level, { x: 120, y: 130 }, opts)).toBeUndefined();
    expect(rulerEdge(level, { x: 400, y: 100 }, opts)).toBeUndefined();
  });

  it("works when the ruler is turned", () => {
    const upright: RulerPose = { center: { x: 0, y: 0 }, angle: Math.PI / 2 };
    const e = rulerEdge(upright, { x: 12, y: 50 }, opts)!;
    // Along the ruler is now down the page; the edge on the right is at x = 11.
    expect(e.origin.x).toBeCloseTo(11);
    expect(pointOn(e, along(e, { x: 30, y: 70 })).x).toBeCloseTo(11);
    expect(pointOn(e, along(e, { x: 30, y: 70 })).y).toBeCloseTo(70);
  });
});

describe("moveRuler", () => {
  it("moves with one finger", () => {
    const p = moveRuler(level, { from: { x: 100, y: 100 }, to: { x: 130, y: 90 }, scale: 1, angle: 0 });
    expect(p).toEqual({ center: { x: 130, y: 90 }, angle: 0 });
  });

  it("turns about the fingers and ignores pinching", () => {
    const p = moveRuler(level, { from: { x: 150, y: 100 }, to: { x: 150, y: 100 }, scale: 2, angle: 0.5 });
    expect(p.angle).toBeCloseTo(0.5);
    expect(Math.hypot(p.center.x - 150, p.center.y - 100)).toBeCloseTo(50);
  });

  it("snaps to level and 45°", () => {
    const p = moveRuler(level, { from: { x: 100, y: 100 }, to: { x: 100, y: 100 }, scale: 1, angle: 0.02 });
    expect(p.angle).toBe(0);
    expect(snapAngle(Math.PI / 4 + 0.01)).toBeCloseTo(Math.PI / 4);
    expect(snapAngle(0.2)).toBe(0.2);
  });
});

describe("rulerDegrees", () => {
  it("reads 0–179", () => {
    expect(rulerDegrees(0)).toBe(0);
    expect(rulerDegrees(-Math.PI / 4)).toBe(135);
    expect(rulerDegrees(Math.PI)).toBe(0);
  });
});

it("hitRuler", () => {
  expect(hitRuler(level, { x: 290, y: 109 }, 10, 200)).toBe(true);
  expect(hitRuler(level, { x: 290, y: 112 }, 10, 200)).toBe(false);
});

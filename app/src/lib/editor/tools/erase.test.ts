import { describe, it, expect } from "vitest";
import { erase } from "./erase";
import type { Point } from "$lib/tauri/bindings";

const p = (x: number, y: number): Point => ({ x, y, pressure: 0.5 });

describe("erase", () => {
  it("removes a single point that sits inside the eraser", () => {
    const result = erase([p(0, 0)], { x: 0, y: 0 }, 10);
    expect(result).toEqual([]);
  });

  it("leaves an untouched stroke as ONE fragment of the same length", () => {
    const stroke = [p(100, 0), p(110, 0), p(120, 0)];
    const result = erase(stroke, { x: 0, y: 0 }, 10); // eraser is far away from the stroke
    expect(result).toHaveLength(1);
    expect(result[0]).toHaveLength(stroke.length);
  });

  it("splits a stroke that passes clean through into two fragments", () => {
    const result = erase([p(-100, 0), p(100, 0)], { x: 0, y: 0 }, 10);
    expect(result).toHaveLength(2);
  });

  it("fully erases a stroke entirely within the eraser", () => {
    const result = erase([p(0, 0), p(1, 0)], { x: 0, y: 0 }, 10);
    expect(result).toEqual([]);
  });
});

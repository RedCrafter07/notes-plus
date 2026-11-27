import { describe, expect, it } from "vitest";
import type { Block } from "#lib/tauri/bindings.ts";
import { scaleBlock } from "./blocks";

const anchor = { x: 10, y: 20 };

describe("scaleBlock", () => {
  it("scales a stroke's points around the anchor and its width with them", () => {
    const s: Block = {
      type: "Stroke",
      id: "a",
      color: "#000",
      thickness: 4,
      opacity: 1,
      points: [
        { x: 10, y: 20, pressure: 0.5 },
        { x: 30, y: 60, pressure: 0.7 },
      ],
    };
    const out = scaleBlock(s, 2, anchor);
    if (out.type !== "Stroke") throw new Error("type changed");
    expect(out.points).toEqual([
      { x: 10, y: 20, pressure: 0.5 },
      { x: 50, y: 100, pressure: 0.7 },
    ]);
    expect(out.thickness).toBe(8);
    expect(out.id).not.toBe("a");
  });

  it("scales text position, wrap width and font size", () => {
    const t: Block = { type: "Text", id: "t", x: 20, y: 40, width: 100, text: "hi", font_size: 18, color: "#000" };
    expect(scaleBlock(t, 0.5, anchor)).toMatchObject({ x: 15, y: 30, width: 50, font_size: 9 });
  });

  it("keeps line width and font size with keepWidths, still moving and stretching", () => {
    const s: Block = {
      type: "Stroke",
      id: "a",
      color: "#000",
      thickness: 4,
      opacity: 1,
      points: [{ x: 30, y: 60, pressure: 0.5 }],
    };
    expect(scaleBlock(s, 2, anchor, { keepWidths: true })).toMatchObject({
      thickness: 4,
      points: [{ x: 50, y: 100 }],
    });
    const t: Block = { type: "Text", id: "t", x: 20, y: 40, width: 100, text: "hi", font_size: 18, color: "#000" };
    expect(scaleBlock(t, 2, anchor, { keepWidths: true })).toMatchObject({ x: 30, y: 60, width: 200, font_size: 18 });
  });

  it("resizes an image and keeps the anchor corner in place", () => {
    const img: Block = { type: "Image", id: "i", x: 10, y: 20, width: 200, height: 100, asset: "x" };
    expect(scaleBlock(img, 1.5, anchor)).toMatchObject({ x: 10, y: 20, width: 300, height: 150 });
  });
});

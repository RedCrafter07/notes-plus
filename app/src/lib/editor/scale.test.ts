import { describe, expect, it } from "vitest";
import type { Block } from "#lib/tauri/bindings.ts";
import { blockInPolygon, mapPoint, scaleBlock, transformBlock, type Similarity } from "./blocks";

describe("lasso modes", () => {
  const loop = [
    { x: 0, y: 0, pressure: 0.5 },
    { x: 100, y: 0, pressure: 0.5 },
    { x: 100, y: 100, pressure: 0.5 },
    { x: 0, y: 100, pressure: 0.5 },
  ];
  const halfIn: Block = {
    type: "Stroke",
    id: "lasso-stroke",
    color: "#000",
    thickness: 2,
    opacity: 1,
    points: [
      { x: 50, y: 50, pressure: 0.5 },
      { x: 150, y: 50, pressure: 0.5 },
    ],
  };
  const imageIn: Block = { type: "Image", id: "lasso-image", x: 10, y: 10, width: 30, height: 30, asset: "a" };
  const bigImage: Block = { type: "Image", id: "lasso-big-image", x: -20, y: -20, width: 200, height: 200, asset: "a" };

  it("touch: selects what the loop reaches into", () => {
    expect(blockInPolygon(halfIn, loop, "touch")).toBe(true);
    expect(blockInPolygon(imageIn, loop, "touch")).toBe(true);
  });

  it("contain: only what lies entirely inside (text over a big image, without it)", () => {
    expect(blockInPolygon(halfIn, loop, "contain")).toBe(false);
    expect(blockInPolygon(imageIn, loop, "contain")).toBe(true);
    expect(blockInPolygon(bigImage, loop, "contain")).toBe(false);
  });

  it("a two-point line (ruler, shape edge) counts where the loop crosses it, not only at its ends", () => {
    const across: Block = {
      ...halfIn,
      id: "lasso-ruler-line",
      points: [
        { x: -200, y: 50, pressure: 0.5 },
        { x: 300, y: 50, pressure: 0.5 },
      ],
    };
    expect(blockInPolygon(across, loop, "touch")).toBe(true);
    expect(blockInPolygon(across, loop, "contain")).toBe(false);
    const away: Block = { ...across, id: "lasso-far-line", points: across.points.map((p) => ({ ...p, y: 500 })) };
    expect(blockInPolygon(away, loop, "touch")).toBe(false);
  });

  it("contain: a line whose ends are inside but that leaves a concave loop is not contained", () => {
    // A U-shaped loop: both ends of the line are in the arms, the middle crosses the gap.
    const u = [
      { x: 0, y: 0 }, { x: 30, y: 0 }, { x: 30, y: 70 }, { x: 70, y: 70 }, { x: 70, y: 0 },
      { x: 100, y: 0 }, { x: 100, y: 100 }, { x: 0, y: 100 },
    ].map((p) => ({ ...p, pressure: 0.5 }));
    const bridge: Block = {
      ...halfIn,
      id: "lasso-bridge",
      points: [
        { x: 15, y: 30, pressure: 0.5 },
        { x: 85, y: 30, pressure: 0.5 },
      ],
    };
    expect(blockInPolygon(bridge, u, "contain")).toBe(false);
    expect(blockInPolygon(bridge, u, "touch")).toBe(true);
  });
});

describe("transformBlock", () => {
  const quarterTurn: Similarity = { from: { x: 0, y: 0 }, to: { x: 100, y: 0 }, scale: 2, angle: Math.PI / 2 };

  it("maps points: move, scale and rotate around `from`", () => {
    const p = mapPoint(quarterTurn, { x: 10, y: 0 });
    expect(p.x).toBeCloseTo(100);
    expect(p.y).toBeCloseTo(20);
  });

  it("rotates ink exactly and scales its width", () => {
    const s: Block = {
      type: "Stroke",
      id: "a",
      color: "#000",
      thickness: 3,
      opacity: 1,
      points: [{ x: 10, y: 0, pressure: 0.4 }],
    };
    const out = transformBlock(s, quarterTurn);
    if (out.type !== "Stroke") throw new Error("type changed");
    expect(out.points[0].x).toBeCloseTo(100);
    expect(out.points[0].y).toBeCloseTo(20);
    expect(out.points[0].pressure).toBe(0.4);
    expect(out.thickness).toBe(6);
  });

  it("keeps an image upright: its centre moves, its size scales", () => {
    const img: Block = { type: "Image", id: "i", x: 0, y: 0, width: 20, height: 10, asset: "x" };
    const out = transformBlock(img, quarterTurn);
    if (out.type !== "Image") throw new Error("type changed");
    // centre (10, 5) -> (100 - 10, 20); size 40 x 20
    expect(out.width).toBe(40);
    expect(out.height).toBe(20);
    expect(out.x + out.width / 2).toBeCloseTo(90);
    expect(out.y + out.height / 2).toBeCloseTo(20);
  });

  it("is a plain move with scale 1 and angle 0", () => {
    const move: Similarity = { from: { x: 5, y: 5 }, to: { x: 8, y: 1 }, scale: 1, angle: 0 };
    expect(mapPoint(move, { x: 10, y: 10 })).toEqual({ x: 13, y: 6 });
  });
});

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

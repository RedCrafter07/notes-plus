import { describe, expect, it } from "vitest";
import type { Block, Page } from "#lib/tauri/bindings.ts";
import { factorFor, resizePage } from "./resizePage";

// Like the lecture scan: a cropped page imported 3.5x too large, written on with width 50.
const scan: Page = {
  id: "p",
  section: null,
  name: "Scan",
  width: 2765,
  height: 4060,
  pattern: "Lines",
  pattern_scale: 100,
  pattern_color: "#ddd",
  background_color: "#fff",
  background_asset: "scan",
  regions: [{ id: "r", name: "R", x: 100, y: 200, width: 2000, height: 1000, format: "a4", orientation: "portrait" }],
  layers: [
    {
      id: "l",
      name: "Layer 1",
      visible: true,
      locked: false,
      blocks: [
        {
          type: "Stroke",
          id: "s",
          color: "#000",
          thickness: 50,
          opacity: 1,
          points: [
            { x: 1000, y: 2000, pressure: 0.5 },
            { x: 2000, y: 2000, pressure: 0.5 },
          ],
        },
        { type: "Text", id: "t", x: 400, y: 800, width: 1200, text: "hi", font_size: 64, color: "#000" },
      ],
    },
  ],
};

describe("resizePage", () => {
  const a4 = { width: 794, height: 1123 };
  const k = factorFor(scan, a4);

  it("finds the factor for a paper width", () => {
    expect(scan.width * k).toBeCloseTo(794);
  });

  it("scales the page, its ink, text, ruling and regions together", () => {
    const r = resizePage(scan, k);
    expect(r.width).toBeCloseTo(794);
    expect(r.height).toBeCloseTo(1166, 0);
    expect(r.pattern_scale).toBe(Math.round(100 * k)); // a whole number in the file
    expect(resizePage({ ...scan, pattern_scale: 2 }, 0.1).pattern_scale).toBe(1);
    expect(r.background_asset).toBe("scan");
    const [s, t] = r.layers[0].blocks as [Extract<Block, { type: "Stroke" }>, Extract<Block, { type: "Text" }>];
    expect(s.thickness).toBeCloseTo(50 * k); // about 14
    expect(s.points[1].x).toBeCloseTo(2000 * k);
    expect(s.id).not.toBe("s");
    expect(t.font_size).toBeCloseTo(64 * k);
    expect(t.width).toBeCloseTo(1200 * k);
    expect(r.regions[0]).toMatchObject({ x: 100 * k, width: 2000 * k, format: "free" });
  });

  it("leaves the page alone for a factor of 1 or nonsense", () => {
    expect(resizePage(scan, 1)).toBe(scan);
    expect(resizePage(scan, 0)).toBe(scan);
    expect(resizePage(scan, NaN)).toBe(scan);
  });
});

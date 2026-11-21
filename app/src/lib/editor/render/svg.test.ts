import { describe, expect, test } from "vitest";
import type { Page } from "#lib/tauri/bindings.ts";
import { boundsFromRect } from "#lib/util/canvasBounds.ts";
import { areaToSvg } from "./svg";

const page: Page = {
  name: "Page 1",
  width: 794,
  height: 1123,
  pattern: "Lines",
  pattern_scale: 24,
  pattern_color: "#dddddd",
  background_color: "#ffffff",
  background_asset: null,
  regions: [],
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
          color: "#ff0000",
          thickness: 4,
          opacity: 0.35,
          points: [
            { x: 10, y: 10, pressure: 0.5 },
            { x: 50, y: 50, pressure: 0.5 },
          ],
        },
        { type: "Text", id: "t", x: 0, y: 0, width: 300, text: "a < b & c", font_size: 16, color: "#000000" },
      ],
    },
  ],
};

describe("areaToSvg", () => {
  const area = boundsFromRect(0, 0, 100, 200);

  test("sizes the document to the area and clips to the sheet", () => {
    const svg = areaToSvg(page, () => undefined, area);
    expect(svg).toContain('width="100" height="200" viewBox="0 0 100 200"');
    expect(svg).toContain('clip-path="url(#sheet)"');
    expect(svg).toContain('fill="url(#paper)"');
  });

  test("keeps highlighter opacity and escapes text", () => {
    const svg = areaToSvg(page, () => undefined, area);
    expect(svg).toContain('fill-opacity="0.35"');
    expect(svg).toContain("a &lt; b &amp; c");
  });

  test("without paper and filtered to a selection", () => {
    const svg = areaToSvg(page, () => undefined, area, { paper: false, only: new Set(["t"]) });
    expect(svg).not.toContain("url(#paper)");
    expect(svg).not.toContain("<path");
    expect(svg).toContain("<text");
  });

  test("is well-formed XML", () => {
    const svg = areaToSvg(page, () => undefined, area);
    const opens = (svg.match(/<(svg|g|text|defs|pattern|clipPath)\b/g) ?? []).length;
    const closes = (svg.match(/<\/(svg|g|text|defs|pattern|clipPath)>/g) ?? []).length;
    expect(opens).toBe(closes);
  });
});

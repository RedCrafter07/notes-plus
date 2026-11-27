import { describe, expect, it } from "vitest";
import type { Page } from "#lib/tauri/bindings.ts";
import { freshCopy, pageAssets } from "./pageCopy";

const page: Page = {
  id: "p",
  section: null,
  name: "Lecture",
  width: 794,
  height: 1123,
  pattern: null,
  pattern_scale: 24,
  pattern_color: "#ddd",
  background_color: "#fff",
  background_asset: "scan",
  regions: [{ id: "r", format: "free", x: 0, y: 0, width: 10, height: 10 } as Page["regions"][number]],
  layers: [
    {
      id: "l",
      name: "Layer 1",
      visible: true,
      locked: false,
      blocks: [
        { type: "Image", id: "i", asset: "photo", x: 0, y: 0, width: 1, height: 1 },
        { type: "Image", id: "j", asset: "scan", x: 0, y: 0, width: 1, height: 1 },
        { type: "Text", id: "t", x: 0, y: 0, width: 10, text: "hi", font_size: 16, color: "#000" },
      ],
    },
  ],
};

describe("page copies", () => {
  it("lists each attachment a page uses once", () => {
    expect(pageAssets([page, page]).sort()).toEqual(["photo", "scan"]);
  });

  it("gives layers, blocks and regions fresh ids, keeping their content", () => {
    const c = freshCopy(page);
    expect(c.layers[0].id).not.toBe("l");
    expect(c.layers[0].blocks.map((b) => b.id)).not.toContain("i");
    expect(c.regions[0].id).not.toBe("r");
    expect(c.layers[0].blocks.map((b) => b.type)).toEqual(["Image", "Image", "Text"]);
    expect(c.background_asset).toBe("scan");
  });
});

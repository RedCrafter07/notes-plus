import { describe, expect, it } from "vitest";
import type { Block, Layer, Page } from "#lib/tauri/bindings.ts";
import { moveBlocksToPage } from "./movePage";

const text = (id: string, x: number, y: number): Block => ({
  type: "Text",
  id,
  x,
  y,
  width: 100,
  text: id,
  font_size: 16,
  color: "#000",
});

const layer = (id: string, blocks: Block[] = [], extra: Partial<Layer> = {}): Layer => ({
  id,
  name: id,
  blocks,
  visible: true,
  locked: false,
  ...extra,
});

function page(id: string, layers: Layer[], width = 794, height = 1123): Page {
  return {
    id,
    section: null,
    name: id,
    width,
    height,
    pattern: null,
    pattern_scale: 24,
    pattern_color: "#dddddd",
    background_color: "#ffffff",
    background_asset: null,
    regions: [],
    layers,
  };
}

const blockIds = (p: Page) => p.layers.map((l) => l.blocks.map((b) => b.id).join(",")).join(" | ");

describe("moveBlocksToPage", () => {
  it("moves the chosen blocks to the same layer and position, one change of the page list", () => {
    const pages = [
      page("1", [layer("a", [text("t1", 10, 10), text("t2", 50, 50)]), layer("b", [text("t3", 20, 20)])]),
      page("2", [layer("c", [text("t4", 0, 0)]), layer("d")]),
    ];
    const r = moveBlocksToPage(pages, 0, 1, new Set(["t2", "t3"]));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(blockIds(r.pages[0])).toBe("t1 | ");
    expect(blockIds(r.pages[1])).toBe("t4,t2 | t3");
    expect(r.ids.sort()).toEqual(["t2", "t3"]);
    // Untouched blocks keep their identity; the originals are unchanged.
    expect(r.pages[1].layers[1].blocks[0]).toBe(pages[0].layers[1].blocks[0]);
    expect(blockIds(pages[0])).toBe("t1,t2 | t3");
  });

  it("uses the top layer when the target has fewer, and skips locked ones", () => {
    const pages = [
      page("1", [layer("a"), layer("b", [text("t", 10, 10)])]),
      page("2", [layer("c"), layer("d", [], { locked: true })]),
      page("3", [layer("e")]),
    ];
    const r = moveBlocksToPage(pages, 0, 1, new Set(["t"]));
    expect(r.ok && blockIds(r.pages[1])).toBe("t | ");
    const r2 = moveBlocksToPage(pages, 0, 2, new Set(["t"]));
    expect(r2.ok && blockIds(r2.pages[2])).toBe("t");
  });

  it("refuses when every layer of the target is locked or hidden", () => {
    const pages = [page("1", [layer("a", [text("t", 0, 0)])]), page("2", [layer("b", [], { visible: false })])];
    expect(moveBlocksToPage(pages, 0, 1, new Set(["t"]))).toEqual({ ok: false, reason: "no-layer" });
    expect(moveBlocksToPage(pages, 0, 0, new Set(["t"]))).toEqual({ ok: false, reason: "same-page" });
  });

  it("nudges the blocks onto a smaller sheet", () => {
    const pages = [page("1", [layer("a", [text("far", 700, 1000)])]), page("2", [layer("b")], 559, 794)];
    const r = moveBlocksToPage(pages, 0, 1, new Set(["far"]));
    if (!r.ok) throw new Error("not moved");
    const b = r.pages[1].layers[0].blocks[0] as Extract<Block, { type: "Text" }>;
    expect(b.x + 100).toBeLessThanOrEqual(559);
    expect(b.y).toBeLessThan(794);
    expect(r.ids).toEqual([b.id]); // a moved block gets a new id
  });
});

import { describe, expect, it } from "vitest";
import type { Block } from "#lib/tauri/bindings.ts";
import { translateBlock } from "./blocks";
import { withoutCoveredCopies } from "./copies";

const stroke = (id: string, x: number, color = "#000"): Block => ({
  type: "Stroke",
  id,
  color,
  thickness: 4,
  opacity: 1,
  points: [
    { x, y: 0, pressure: 0.5 },
    { x: x + 100, y: 40, pressure: 0.6 },
    { x: x + 200, y: 0, pressure: 0.5 },
  ],
});
const image: Block = { type: "Image", id: "img", asset: "a", x: 0, y: 0, width: 300, height: 200 };
const text: Block = { type: "Text", id: "txt", x: 20, y: 20, width: 200, text: "Note", font_size: 16, color: "#000" };

const ids = (entries: { block: Block }[]) => entries.map((e) => e.block.id);
const entries = (...blocks: Block[]) => blocks.map((block, index) => ({ index, block }));

describe("withoutCoveredCopies", () => {
  it("keeps only the duplicate on top of its original", () => {
    const original = stroke("s", 0);
    const copy = translateBlock(original, 16, 16); // what Duplicate makes
    expect(ids(withoutCoveredCopies(entries(original, copy)))).toEqual([copy.id]);
  });

  it("also for a thin straight line, which Duplicate moves clear of itself", () => {
    const line: Block = { ...stroke("l", 0), points: [{ x: 0, y: 0, pressure: 0.5 }, { x: 300, y: 0, pressure: 0.5 }] };
    const copy = translateBlock(line, 16, 16);
    expect(ids(withoutCoveredCopies(entries(line, copy)))).toEqual([copy.id]);
  });

  it("works for a duplicated group, and for a copy of a copy", () => {
    const a = stroke("a", 0);
    const b = stroke("b", 500, "#f00");
    const a2 = translateBlock(a, 16, 16);
    const b2 = translateBlock(b, 16, 16);
    const a3 = translateBlock(a2, 16, 16);
    expect(ids(withoutCoveredCopies(entries(a, b, a2, b2, a3)))).toEqual([b2.id, a3.id]);
  });

  it("selects different blocks that overlap, like text on an image", () => {
    expect(ids(withoutCoveredCopies(entries(image, text)))).toEqual(["img", "txt"]);
    // Same shape but another colour: not a copy.
    expect(withoutCoveredCopies(entries(stroke("x", 0), stroke("y", 10, "#00f")))).toHaveLength(2);
  });

  it("selects a copy moved away together with its original", () => {
    const original = stroke("s", 0);
    const moved = translateBlock(original, 0, 400);
    expect(withoutCoveredCopies(entries(original, moved))).toHaveLength(2);
  });

  it("keeps the original when it is the one on top", () => {
    const copy = translateBlock(stroke("s", 0), 16, 16);
    const original = stroke("s", 0);
    // The original was brought to the front: it covers the copy.
    expect(ids(withoutCoveredCopies(entries(copy, original)))).toEqual(["s"]);
  });
});

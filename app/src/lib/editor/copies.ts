import type { Block } from "#lib/tauri/bindings.ts";
import { boundsIntersect, padBounds } from "#lib/util/canvasBounds.ts";
import { assertNever, blockBounds } from "./blocks";

/*
 * Lassoing a duplicate. Duplicate puts the copy slightly offset on top of
 * the original, and a lasso around it caught both, so the copy could not
 * be selected on its own once deselected. Among the blocks a lasso
 * catches, a block with an identical copy above it (same shape, colour and
 * size, only moved) lying on or right next to it is left out: the copy on
 * top is selected. ("Next to": Duplicate moves the copy by 16 units, which
 * takes a thin straight line clear of its original.) Nothing else
 * changes: different blocks overlapping (text on an image) are all
 * selected, and a copy moved away from its original is selected together
 * with it.
 */

/** Copies this close (content units, either way) count as lying on each other. */
const NEAR = 24;

/** Coordinates are compared to this precision (moving adds float noise). */
const round = (v: number) => Math.round(v * 100) / 100;

/** What a block looks like, independent of where it is. */
export function shapeKey(b: Block): string {
  switch (b.type) {
    case "Stroke": {
      const o = b.points[0] ?? { x: 0, y: 0 };
      const rel = b.points.map((p) => `${round(p.x - o.x)},${round(p.y - o.y)},${round(p.pressure)}`).join(";");
      return `S|${b.color}|${round(b.thickness)}|${b.opacity}|${b.thinning ?? 0}|${!!b.smoothed}|${rel}`;
    }
    case "Text":
      return `T|${b.color}|${round(b.font_size)}|${round(b.width)}|${b.text}`;
    case "Image":
      return `I|${b.asset}|${round(b.width)}|${round(b.height)}`;
    default:
      return assertNever(b);
  }
}

/**
 * Drops the entries that have an identical, overlapping copy above them
 * (a higher `index` in the same layer). Order is kept.
 */
export function withoutCoveredCopies<T extends { index: number; block: Block }>(entries: T[]): T[] {
  if (entries.length < 2) return entries;
  const above = new Map<string, Block[]>();
  const covered = new Set<T>();
  // From the top down: each block is checked against the copies above it.
  for (const e of [...entries].sort((a, b) => b.index - a.index)) {
    const key = shapeKey(e.block);
    const b = blockBounds(e.block);
    const bounds = b && padBounds(b, NEAR);
    const same = above.get(key);
    if (bounds && same?.some((c) => { const r = blockBounds(c); return !!r && boundsIntersect(r, bounds); }))
      covered.add(e);
    above.set(key, [...(same ?? []), e.block]);
  }
  return covered.size ? entries.filter((e) => !covered.has(e)) : entries;
}

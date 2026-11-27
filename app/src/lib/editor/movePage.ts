import type { Block, Page } from "#lib/tauri/bindings.ts";
import { unionBounds, type ContentBounds } from "#lib/util/canvasBounds.ts";
import { blockBounds, translateBlock } from "./blocks";
import { pageRect } from "./pageFormats";

/*
 * Moving a selection to another page: the blocks leave their page and
 * land on the target at the same position, as one change of the page list
 * (so one undo step, see `contentManager.restructure`).
 *
 * Each block goes to the target's layer at the same position in the layer
 * list (or its top layer if it has fewer). A locked or hidden layer there
 * is skipped for the first usable one. If the target sheet is smaller, the
 * blocks are nudged onto it as a group.
 */

export type MoveResult =
  | { ok: true; pages: Page[]; ids: string[] }
  | { ok: false; reason: "no-layer" | "same-page" | "nothing" };

export function moveBlocksToPage(pages: Page[], from: number, to: number, ids: Set<string>): MoveResult {
  if (from === to) return { ok: false, reason: "same-page" };
  const src = pages[from];
  const dst = pages[to];
  if (!src || !dst) return { ok: false, reason: "nothing" };

  const usable = (i: number) => !dst.layers[i].locked && dst.layers[i].visible;
  const fallback = dst.layers.findIndex((_, i) => usable(i));
  if (fallback === -1) return { ok: false, reason: "no-layer" };

  // Picked blocks per target layer index, in drawing order.
  const incoming = new Map<number, Block[]>();
  const srcLayers = src.layers.map((l, li) => {
    const picked = l.blocks.filter((b) => ids.has(b.id));
    if (!picked.length) return l;
    const target = Math.min(li, dst.layers.length - 1);
    const ti = usable(target) ? target : fallback;
    incoming.set(ti, [...(incoming.get(ti) ?? []), ...picked]);
    return { ...l, blocks: l.blocks.filter((b) => !ids.has(b.id)) };
  });
  if (!incoming.size) return { ok: false, reason: "nothing" };

  const all = [...incoming.values()].flat();
  const [dx, dy] = nudgeOnto(all, pageRect(dst));
  const moved = new Map(
    [...incoming].map(([ti, blocks]) => [ti, dx || dy ? blocks.map((b) => translateBlock(b, dx, dy)) : blocks]),
  );

  const next = pages.slice();
  next[from] = { ...src, layers: srcLayers };
  next[to] = {
    ...dst,
    layers: dst.layers.map((l, i) => (moved.has(i) ? { ...l, blocks: [...l.blocks, ...moved.get(i)!] } : l)),
  };
  return { ok: true, pages: next, ids: [...moved.values()].flat().map((b) => b.id) };
}

/** How far to move the blocks so they lie on `sheet` (top-left wins if they cannot fit). */
function nudgeOnto(blocks: Block[], sheet: ContentBounds | null): [number, number] {
  if (!sheet) return [0, 0];
  const all = blocks.map(blockBounds).filter((x): x is ContentBounds => !!x);
  if (!all.length) return [0, 0];
  const b = all.reduce(unionBounds);
  const axis = (min: number, max: number, lo: number, hi: number) =>
    max - min > hi - lo || min < lo ? lo - min : max > hi ? hi - max : 0;
  return [axis(b.min.x, b.max.x, sheet.min.x, sheet.max.x), axis(b.min.y, b.max.y, sheet.min.y, sheet.max.y)];
}

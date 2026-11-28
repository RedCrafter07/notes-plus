import { contentManager } from "#lib/state/contentManager.svelte.ts";
import type { Block, Point } from "#lib/tauri/bindings.ts";
import { blockBounds, blockInPolygon, type LassoMode } from "../blocks";
import { withoutCoveredCopies } from "../copies";

export type LassoSelection = Record<string, { index: number; block: Block }[]>;

export function runSelection(lassoPoints: Point[], mode: LassoMode = "touch"): LassoSelection | undefined {
  if (lassoPoints.length < 3) return undefined;

  const selection: LassoSelection = {};

  // Blocks whose bounds miss the loop's bounds cannot be inside it; skipping
  // them saves testing every point of every stroke on the page.
  const xs = lassoPoints.map((p) => p.x);
  const ys = lassoPoints.map((p) => p.y);
  const [minX, maxX, minY, maxY] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
  const nearLoop = (b: Block) => {
    const r = blockBounds(b);
    return !r || (r.max.x >= minX && r.min.x <= maxX && r.max.y >= minY && r.min.y <= maxY);
  };

  contentManager.layers.forEach((layer) => {
    if (layer.locked || !layer.visible) return;

    const selectedInLayer: { index: number; block: Block }[] = [];

    layer.blocks.forEach((block, index) => {
      if (nearLoop(block) && blockInPolygon(block, lassoPoints, mode))
        selectedInLayer.push({ index, block });
    });

    // A duplicate lying on its original: only the copy on top (copies.ts).
    const picked = withoutCoveredCopies(selectedInLayer);
    if (picked.length > 0) {
      selection[layer.id] = picked;
    }
  });

  return Object.keys(selection).length > 0 ? selection : undefined;
}

export function selectionFromIds(blockIds: string[]): LassoSelection | null {
  if (blockIds.length === 0) return null;

  const wanted = new Set(blockIds);
  const selection: LassoSelection = {};

  contentManager.layers.forEach((l) => {
    const layerSelection: { index: number; block: Block }[] = [];

    l.blocks.forEach((block, index) => {
      if (wanted.has(block.id)) layerSelection.push({ index, block });
    });

    if (layerSelection.length > 0) selection[l.id] = layerSelection;
  });

  return Object.keys(selection).length > 0 ? selection : null;
}

/** Ids of every selected block. */
export function selectionIds(s: LassoSelection | undefined | null): string[] {
  if (!s) return [];
  return Object.values(s).flatMap((e) => e.map((x) => x.block.id));
}

import { contentManager } from "$lib/state/contentManager.svelte";
import type { Block, Point } from "$lib/tauri/bindings";
import { blockInPolygon } from "../blocks";

export type LassoSelection = Record<string, { index: number; block: Block }[]>;

export function runSelection(lassoPoints: Point[]): LassoSelection | undefined {
  if (lassoPoints.length < 3) return undefined;

  const selection: LassoSelection = {};

  contentManager.layers.forEach((layer) => {
    if (layer.locked || !layer.visible) return;

    const selectedInLayer: { index: number; block: Block }[] = [];

    layer.blocks.forEach((block, index) => {
      if (blockInPolygon(block, lassoPoints))
        selectedInLayer.push({ index, block });
    });

    if (selectedInLayer.length > 0) {
      selection[layer.id] = selectedInLayer;
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

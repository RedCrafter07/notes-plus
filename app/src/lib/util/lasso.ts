import { contentManager } from "$lib/state/contentManager.svelte";
import type { Block, Point } from "$lib/tauri/bindings";

export type LassoSelection = Record<string, { index: number; block: Block }[]>;

export function isPointInPolygon(p: Point, polygon: Point[]) {
  let isInside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i].x,
      yi = polygon[i].y;
    const xj = polygon[j].x,
      yj = polygon[j].y;

    const intersect =
      yi > p.y !== yj > p.y && p.x < ((xj - xi) * (p.y - yi)) / (yj - yi) + xi;

    if (intersect) isInside = !isInside;
  }

  return isInside;
}

export function runSelection(lassoPoints: Point[]): LassoSelection | undefined {
  if (lassoPoints.length < 3) return undefined;

  const selection: LassoSelection = {};

  contentManager.layers.forEach((layer) => {
    if (layer.locked || !layer.visible) return;

    const selectedInLayer: { index: number; block: Block }[] = [];

    layer.blocks.forEach((block, index) => {
      if (block.Stroke) {
        const isSelected = block.Stroke.points.some((p) =>
          isPointInPolygon(p, lassoPoints),
        );

        if (isSelected) {
          selectedInLayer.push({ index, block });
        }
      }
    });

    if (selectedInLayer.length > 0) {
      selection[layer.id] = selectedInLayer;
    }
  });

  return Object.keys(selection).length > 0 ? selection : undefined;
}

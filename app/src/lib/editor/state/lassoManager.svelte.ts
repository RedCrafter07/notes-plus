import { contentManager } from "#lib/state/contentManager.svelte.ts";
import {
  runSelection,
  selectionIds,
  type LassoSelection,
} from "#lib/editor/tools/lasso.ts";
import type { Block, Point } from "#lib/tauri/bindings.ts";
import { tabManager } from "#lib/state/tabManager.svelte.ts";
import { popupManager } from "#lib/state/popupManager.svelte.ts";
import { unionBounds, type ContentBounds } from "#lib/util/canvasBounds.ts";
import {
  blockBounds,
  blockColor,
  cloneBlock,
  recolorBlock,
  translateBlock,
} from "../blocks";

/*
 * Every mutation here assigns a *new* `blocks` array to the layer instead of
 * editing the old one in place. The renderer only watches array identity, and
 * history compares arrays, so in-place edits would be invisible to both.
 */
export class LassoManager {
  isSelecting = $state(true);
  points = $state<Point[]>([]);
  selection = $state<LassoSelection>();

  dragOffsetX = $state(0);
  dragOffsetY = $state(0);
  dragStart = $state({ x: 0, y: 0 });

  isDraggingSelection = $state(false);

  selectedLayers = $derived(this.selection ? Object.keys(this.selection) : []);
  boundingBox = $derived(this.getSelectionBoundingBox());
  /** Ids of selected blocks; the canvas skips them and the overlay draws them. */
  selectedIds = $derived(new Set(selectionIds(this.selection)));

  private getSelectionBoundingBox() {
    if (!this.selection) return;

    let acc: ContentBounds | null = null;
    for (const entries of Object.values(this.selection))
      for (const { block } of entries) {
        const b = blockBounds(block);
        if (b) acc = acc ? unionBounds(acc, b) : b;
      }

    if (!acc) return { x: 0, y: 0, width: 0, height: 0 };

    const padding = 4;
    return {
      x: acc.min.x - padding,
      y: acc.min.y - padding,
      width: acc.width + padding * 2,
      height: acc.height + padding * 2,
    };
  }

  updateSelection() {
    this.selection = runSelection(this.points);
  }

  /** Replaces each selected block via `fn`, keeping positions and the selection. */
  private mapSelection(fn: (b: Block) => Block) {
    if (!this.selection) return;
    const next: LassoSelection = {};

    for (const layerId of this.selectedLayers) {
      const layer = contentManager.layers.find((l) => l.id === layerId);
      if (!layer) continue;

      const blocks = [...layer.blocks];
      // One pass over the layer, not one search per selected block: a big
      // selection on a full page made dropping it take seconds.
      const indexOf = new Map(blocks.map((b, i) => [b.id, i]));
      next[layerId] = this.selection[layerId].map(({ block }) => {
        const index = indexOf.get(block.id) ?? -1;
        const replaced = fn(block);
        if (index !== -1) blocks[index] = replaced;
        return { index, block: replaced };
      });

      layer.blocks = blocks;
    }

    this.selection = next;
  }

  deleteSelection() {
    tabManager.transact("Delete", () => {
      const ids = this.selectedIds;
      for (const layerId of this.selectedLayers) {
        const layer = contentManager.layers.find((l) => l.id === layerId);
        if (layer) layer.blocks = layer.blocks.filter((b) => !ids.has(b.id));
      }
      this.reset();
    });
  }

  duplicateSelection() {
    if (!this.selection) return;

    tabManager.transact("Duplicate", () => {
      const next: LassoSelection = {};

      for (const layerId of this.selectedLayers) {
        const layer = contentManager.layers.find((l) => l.id === layerId);
        if (!layer) continue;

        const ids = new Set(this.selection![layerId].map((s) => s.block.id));
        let last = -1;
        layer.blocks.forEach((b, i) => {
          if (ids.has(b.id)) last = i;
        });
        if (last === -1) continue;

        // Offset the copies so they are visibly separate from the originals.
        const copies = this.selection![layerId].map((s) =>
          translateBlock(cloneBlock(s.block), 16, 16),
        );
        layer.blocks = [
          ...layer.blocks.slice(0, last + 1),
          ...copies,
          ...layer.blocks.slice(last + 1),
        ];
        next[layerId] = copies.map((block, i) => ({ index: last + 1 + i, block }));
      }

      this.selection = next;
      this.dragOffsetX = 0;
      this.dragOffsetY = 0;
    });

    popupManager.add({ message: "Elements duplicated", type: "success" });
  }

  /** The shared colour of the selection, or `null` if mixed or colourless. */
  get selectionColor(): string | null {
    let color: string | null = null;
    for (const entries of Object.values(this.selection ?? {}))
      for (const { block } of entries) {
        const c = blockColor(block);
        if (c === null) continue;
        if (color === null) color = c;
        else if (c !== color) return null;
      }
    return color;
  }

  colorSelection(color: string) {
    tabManager.transact("Change color", () => {
      this.mapSelection((b) => recolorBlock(b, color));
    });
  }

  updateDrag() {
    const dx = this.dragOffsetX;
    const dy = this.dragOffsetY;
    this.dragOffsetX = 0;
    this.dragOffsetY = 0;

    if (dx === 0 && dy === 0) return;
    this.mapSelection((b) => translateBlock(b, dx, dy));
  }

  reset() {
    this.points = [];
    this.isSelecting = true;
    this.dragOffsetX = 0;
    this.dragOffsetY = 0;
    this.selection = undefined;
    this.isDraggingSelection = false;
  }

  commit() {
    if (this.isDraggingSelection) {
      this.isDraggingSelection = false;
      this.updateDrag();
      return;
    }

    if (!this.isSelecting) return;

    this.updateSelection();

    const hasSelection = this.selectedIds.size > 0;
    this.isSelecting = !hasSelection;
    if (!hasSelection) this.points = [];
  }

  begin(point: Point) {
    if (this.isSelecting) {
      this.points = [point];
    } else if (this.isInsideSelection(point)) {
      this.isDraggingSelection = true;
      this.dragStart = point;
    } else {
      this.reset();
    }
  }

  isInsideSelection(p: Point) {
    const b = this.boundingBox;
    if (!b) return false;

    return (
      p.x >= b.x && p.x <= b.x + b.width && p.y >= b.y && p.y <= b.y + b.height
    );
  }
}

export const lassoManager = new LassoManager();

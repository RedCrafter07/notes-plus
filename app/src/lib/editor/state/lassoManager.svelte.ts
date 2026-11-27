import { contentManager } from "#lib/state/contentManager.svelte.ts";
import {
  runSelection,
  selectionIds,
  type LassoSelection,
} from "#lib/editor/tools/lasso.ts";
import type { Block, Point } from "#lib/tauri/bindings.ts";
import { tabManager } from "#lib/state/tabManager.svelte.ts";
import { popupManager } from "#lib/state/popupManager.svelte.ts";
import { unionBounds, type ContentBounds, type Point2D } from "#lib/util/canvasBounds.ts";
import {
  blockBounds,
  blockColor,
  cloneBlock,
  newId,
  recolorBlock,
  scaleBlock,
  translateBlock,
} from "../blocks";

/** How close (in screen pixels) a press must be to a corner to grab it. */
const HANDLE_HIT_PX = 16;
/** Scaling stops here, so a selection cannot collapse to nothing. */
const MIN_SCALE = 0.05;

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

  /** Widths of the selected strokes (text and images have none). */
  get strokeWidths(): number[] {
    return Object.values(this.selection ?? {}).flatMap((entries) =>
      entries.flatMap(({ block }) => (block.type === "Stroke" ? [block.thickness] : [])),
    );
  }

  /** The selection as it was when the current width change began. */
  #widthBase?: LassoSelection;

  /**
   * Sets the selected strokes to `factor` times the width they had when the
   * change began (not cumulative, so a slider can go back and forth), keeping
   * mixed widths in proportion. Text and images stay as they are. A drag is
   * one undo step: history opens on the first change and `endWidthChange`
   * closes it.
   */
  scaleWidth(factor: number) {
    if (!this.selection) return;
    if (!this.#widthBase) {
      this.#widthBase = this.selection;
      tabManager.tab?.history.begin("Change width");
    }
    const base = this.#widthBase;
    const next: LassoSelection = {};

    for (const layerId of this.selectedLayers) {
      const layer = contentManager.layers.find((l) => l.id === layerId);
      if (!layer) continue;
      const blocks = [...layer.blocks];
      const indexOf = new Map(blocks.map((b, i) => [b.id, i]));
      next[layerId] = this.selection[layerId].map(({ block }, i) => {
        const original = base[layerId]?.[i]?.block ?? block;
        const replaced =
          original.type === "Stroke"
            ? { ...original, id: newId(), thickness: original.thickness * factor }
            : block;
        const index = indexOf.get(block.id) ?? -1;
        if (index !== -1) blocks[index] = replaced;
        return { index, block: replaced };
      });
      layer.blocks = blocks;
    }
    this.selection = next;
  }

  /** Ends a width change as one undo step. */
  endWidthChange() {
    if (!this.#widthBase) return;
    this.#widthBase = undefined;
    tabManager.tab?.history.commit();
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
    this.endWidthChange();
    this.points = [];
    this.isSelecting = true;
    this.dragOffsetX = 0;
    this.dragOffsetY = 0;
    this.selection = undefined;
    this.isDraggingSelection = false;
    this.scaling = undefined;
  }

  /*
   * Scaling by a corner handle: proportional, around the opposite corner.
   * While the pen moves only `scaling.factor` changes (the selection canvas
   * and frame preview it with a transform); the blocks are scaled once, on
   * release, as part of the gesture's undo step.
   */
  scaling = $state<{ anchor: Point2D; corner: Point2D; factor: number }>();

  /** The frame's corners, clockwise from the top left. */
  get corners(): Point2D[] {
    const b = this.boundingBox;
    if (!b) return [];
    return [
      { x: b.x, y: b.y },
      { x: b.x + b.width, y: b.y },
      { x: b.x + b.width, y: b.y + b.height },
      { x: b.x, y: b.y + b.height },
    ];
  }

  /** Starts scaling if `p` is on a corner handle. */
  #startScale(p: Point): boolean {
    const reach = HANDLE_HIT_PX / contentManager.zoom;
    const corners = this.corners;
    const i = corners.findIndex((c) => Math.hypot(p.x - c.x, p.y - c.y) <= reach);
    if (i === -1) return false;
    this.scaling = { anchor: corners[(i + 2) % 4], corner: corners[i], factor: 1 };
    return true;
  }

  /** The pointer's position along the anchor–corner diagonal sets the scale. */
  updateScale(p: Point) {
    const s = this.scaling;
    if (!s) return;
    const vx = s.corner.x - s.anchor.x;
    const vy = s.corner.y - s.anchor.y;
    const len2 = vx * vx + vy * vy;
    if (len2 === 0) return;
    const f = ((p.x - s.anchor.x) * vx + (p.y - s.anchor.y) * vy) / len2;
    this.scaling = { ...s, factor: Math.max(MIN_SCALE, f) };
  }

  commit() {
    if (this.scaling) {
      const { factor, anchor } = this.scaling;
      this.scaling = undefined;
      if (Math.abs(factor - 1) > 1e-3) this.mapSelection((b) => scaleBlock(b, factor, anchor));
      return;
    }

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
    } else if (this.#startScale(point)) {
      // A corner handle: scaling (checked first, the corners are on the frame).
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

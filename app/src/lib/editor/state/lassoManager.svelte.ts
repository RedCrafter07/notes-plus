import { contentManager } from "$lib/state/contentManager.svelte";
import { runSelection, type LassoSelection } from "$lib/editor/tools/lasso";
import type { Point } from "$lib/tauri/bindings";
import { tabManager } from "$lib/state/tabManager.svelte";

export class LassoManager {
  isSelecting = $state(true);
  points = $state<Point[]>([]);
  selection = $state<LassoSelection>();

  dragOffsetX = $state(0);
  dragOffsetY = $state(0);
  dragStart = $state({ x: 0, y: 0 });

  isDraggingSelection = $state(false);
  scaleFactor = $state(1);

  selectedLayers = $derived(this.selection ? Object.keys(this.selection) : []);
  boundingBox = $derived(this.getSelectionBoundingBox(this.selectedLayers));

  private getSelectionBoundingBox(selectedLayers: string[]) {
    if (!this.selection) return;

    let minX = Infinity,
      minY = Infinity;
    let maxX = -Infinity,
      maxY = -Infinity;
    let maxThickness = 0;

    selectedLayers
      .flatMap((l) => this.selection![l])
      .forEach((v) => {
        if (v.block.Stroke.thickness > maxThickness) {
          maxThickness = v.block.Stroke.thickness;
        }
        v.block.Stroke.points.forEach((p) => {
          if (p.x < minX) minX = p.x;
          if (p.y < minY) minY = p.y;
          if (p.x > maxX) maxX = p.x;
          if (p.y > maxY) maxY = p.y;
        });
      });

    if (minX === Infinity) return { x: 0, y: 0, width: 0, height: 0 };

    const padding = maxThickness / 2 + 2;
    return {
      x: minX - padding,
      y: minY - padding,
      width: maxX - minX + padding * 2,
      height: maxY - minY + padding * 2,
    };
  }

  updateSelection() {
    this.selection = runSelection(this.points);
  }

  updateDrag() {
    if (!this.selection) return;

    this.selectedLayers.forEach((l) => {
      const contents = this.selection![l];
      this.selection![l] = contents.map((c) => ({
        ...c,
        block: {
          Stroke: {
            ...c.block.Stroke,
            points: c.block.Stroke.points.map((p) => ({
              ...p,
              x: p.x + this.dragOffsetX,
              y: p.y + this.dragOffsetY,
            })),
          },
        },
      }));
    });

    this.selectedLayers.forEach((lID) => {
      const i = contentManager.layers.findIndex((l) => l.id === lID);
      if (i >= 0) {
        const selectedLayer = this.selection![lID];
        const newBlocks = contentManager.layers[i].blocks;

        selectedLayer.forEach((l) => {
          newBlocks[l.index] = l.block;
        });

        contentManager.layers[i].blocks = newBlocks;
      }
    });

    tabManager.setEdited();

    this.dragOffsetX = 0;
    this.dragOffsetY = 0;
  }

  reset() {
    this.points = [];
    this.isSelecting = true;
    this.dragOffsetX = 0;
    this.dragOffsetY = 0;
    this.scaleFactor = 1;
    this.selection = undefined;
  }
}

export const lassoManager = new LassoManager();

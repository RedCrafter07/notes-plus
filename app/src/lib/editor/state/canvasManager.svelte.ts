import { contentManager } from "$lib/state/contentManager.svelte";
import { tabManager } from "$lib/state/tabManager.svelte";
import type { Block, Point } from "$lib/tauri/bindings";
import { erase } from "../tools/erase";

export type Tool = "eraser" | "pen" | "lasso";

export class CanvasManager {
  tool = $state<Tool>("pen");
  lockTool = $state(false);
  color = $state("#000000");
  thickness = $state(8);
  eraserRadius = $state(24);

  drawing = $state(false);
  points = $state<Point[]>([]);

  width = $state(0);
  height = $state(0);
  layerCtx = $state<Record<string, CanvasRenderingContext2D>>({});

  dpr = $state(typeof window !== undefined ? window.devicePixelRatio : 1);

  activeLayerID = $derived(
    contentManager.layers[contentManager.activeLayer]?.id,
  );

  addPoint(x: number, y: number, pressure: number) {
    const p = this.translateToRelative(x, y, pressure);

    if (this.points.length === 0) {
      this.points.push(p);
      return;
    }

    const lastPoint = this.points[this.points.length - 1];
    if (!lastPoint) {
      this.points.push(p);
      return;
    }

    const dx = p.x - lastPoint.x;
    const dy = p.y - lastPoint.y;
    const distSq = dx * dx + dy * dy;

    if (distSq > 4) {
      this.points.push(p);
    }
  }

  assignContext(element: HTMLCanvasElement, id: string) {
    const ctx = element.getContext("2d");
    if (ctx) {
      this.layerCtx[id] = ctx;
    }
  }

  translateToRelative(x: number, y: number, pressure: number = 0.5) {
    x = x - this.width / 2;
    y = y - this.height / 2;

    x = x / contentManager.zoom;
    y = y / contentManager.zoom;

    x = x - contentManager.panX;
    y = y - contentManager.panY;

    return {
      x,
      y,
      pressure,
    };
  }

  eraser(x: number, y: number) {
    contentManager.layers.forEach((l, i) => {
      if (l.locked || !l.visible) return l;

      const blocks = l.blocks.flatMap((b) => {
        if (b.Stroke) {
          const s = b.Stroke;
          if (s.points.length === 1) return b;
          if (s.points.length === 0) return [];
          const newPoints = erase(
            s.points,
            this.translateToRelative(x, y, 0.5),
            this.eraserRadius,
          );

          return newPoints.map(
            (p) =>
              ({
                Stroke: {
                  ...s,
                  id: crypto.randomUUID(),
                  points: p,
                },
              }) satisfies Block,
          );
        } else return b;
      });

      contentManager.layers[i] = {
        ...l,
        blocks,
      };
    });
  }

  finishStroke() {
    if (this.points.length === 0) return;

    contentManager.layers[contentManager.activeLayer].blocks.push({
      Stroke: {
        id: crypto.randomUUID(),
        color: this.color,
        thickness: this.thickness,
        points: this.points,
      },
    });

    tabManager.setEdited();

    this.points = [];
  }
}

export const canvasManager = new CanvasManager();

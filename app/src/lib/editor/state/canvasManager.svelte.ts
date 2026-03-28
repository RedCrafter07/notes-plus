import { contentManager } from "$lib/state/contentManager.svelte";
import { tabManager } from "$lib/state/tabManager.svelte";
import type { Block, Point } from "$lib/tauri/bindings";
import { inputToPath } from "../svg";
import { erase } from "../tools/erase";
import { lassoManager } from "./lassoManager.svelte";

export type Tool = "eraser" | "pen" | "lasso";

class CanvasManager {
  #tool = $state<Tool>("pen");
  lockTool = $state(false);
  zoomLock = $state(true);
  color = $state("#000000");
  #thickness = $state(8);
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

    if (distSq > 0) {
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

  translateToAbsolute(p: Point): Point {
    let { x, y, pressure } = p;

    x = x + contentManager.panX;
    y = y + contentManager.panY;
    x = x * contentManager.zoom;
    y = y * contentManager.zoom;
    x = x + this.width / 2;
    y = y + this.height / 2;

    return { x, y, pressure };
  }

  eraser(x: number, y: number) {
    contentManager.layers.forEach((l, i) => {
      if (l.locked || !l.visible) return l;

      const blocks = l.blocks.flatMap((b) => {
        if (b.Stroke) {
          const s = b.Stroke;
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

  clearCanvas() {
    for (const id in canvasManager.layerCtx) {
      const ctx = canvasManager.layerCtx[id];

      ctx.save();
      ctx.resetTransform();
      ctx.clearRect(
        0,
        0,
        canvasManager.width * this.dpr,
        canvasManager.height * this.dpr,
      );
      ctx.restore();
    }
  }

  redrawStrokes() {
    if (canvasManager.drawing) return;
    this.clearCanvas();

    contentManager.layers.forEach((l) => {
      const selectedStrokes = lassoManager.selection
        ? (lassoManager.selection[l.id] ?? [])
        : [];

      const strokes = l.blocks
        .filter((b) => b.Stroke !== undefined)
        .map((b) => b.Stroke)
        .filter(
          (s) => !selectedStrokes.some((sel) => sel.block.Stroke.id === s.id),
        );

      const ctx = canvasManager.layerCtx[l.id];

      ctx.resetTransform();
      ctx.scale(this.dpr, this.dpr);
      ctx.translate(canvasManager.width / 2, canvasManager.height / 2);
      ctx.scale(contentManager.zoom, contentManager.zoom);
      ctx.translate(contentManager.panX, contentManager.panY);

      for (const { color, points, thickness } of strokes) {
        this.drawOnCanvas(inputToPath(points, thickness, false), color);
      }
    });
  }

  private drawOnCanvas(path: string | Path2D, c = canvasManager.color) {
    const ctx = canvasManager.layerCtx[this.activeLayerID];
    if (!ctx) return;
    if (typeof path === "string") path = new Path2D(path);

    ctx.fillStyle = c;
    ctx?.fill(path);
  }

  get tool() {
    return this.#tool;
  }

  set tool(tool: Tool) {
    if (this.#tool === "lasso" && tool !== "lasso") {
      lassoManager.reset();
    }
    this.#tool = tool;
  }

  get thickness() {
    return !this.zoomLock
      ? this.#thickness / contentManager.zoom
      : this.#thickness;
  }

  set thickness(t: number) {
    this.#thickness = t;
  }
}

export const canvasManager = new CanvasManager();

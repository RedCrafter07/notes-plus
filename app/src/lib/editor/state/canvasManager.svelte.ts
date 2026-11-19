import { contentManager } from "$lib/state/contentManager.svelte";
import { popupManager } from "$lib/state/popupManager.svelte";
import { tabManager } from "$lib/state/tabManager.svelte";
import type { Block, Point } from "$lib/tauri/bindings";
import {
  boundsFromRect,
  circleIntersectsBounds,
  type ContentBounds,
  type Point2D,
} from "$lib/util/canvasBounds";
import { blockBounds, newId, pruneBlockCaches } from "../blocks";
import { isInfinite, pageExtent, pageRect } from "../pageFormats";
import { drawBlocks } from "../render/draw";
import { onPaint, requestRedraw } from "../render/scheduler";
import { defaultSizes, toolDef, type Tool } from "../tools/registry";
import { erase } from "../tools/erase";
import { lassoManager } from "./lassoManager.svelte";
import { textEditor } from "./textEditor.svelte";

export type { Tool } from "../tools/registry";

/** Screen pixels of margin around a page when fitting it to the view. */
const FIT_MARGIN = 32;
/** Never zoom past this when fitting a page; huge zoom on a big screen is unpleasant. */
const MAX_FIT_ZOOM = 1.6;
/** Screen pixels of a fixed page that always stay on screen while panning. */
const KEEP_VISIBLE = 64;

class CanvasManager {
  #tool = $state<Tool>("pen");
  lockTool = $state(false);
  /** When on, stroke width is in page units and grows with zoom (like paper). */
  zoomLock = $state(true);
  color = $state("#000000");
  /** Per-tool size: stroke width, eraser radius or font size. */
  sizes = $state<Record<Tool, number>>(defaultSizes());

  drawing = $state(false);
  points = $state<Point[]>([]);

  width = $state(0);
  height = $state(0);
  layerCtx: Record<string, CanvasRenderingContext2D> = {};

  dpr = $state(typeof window !== "undefined" ? window.devicePixelRatio : 1);

  constructor() {
    onPaint(() => this.paint());
  }

  // ---------------------------------------------------------------- rendering

  /**
   * Reads everything that affects the layer canvases, so that calling this
   * inside an `$effect` re-runs it (and schedules one repaint) whenever any of
   * it changes. This replaces calling `redrawStrokes()` by hand after every
   * mutation: forgetting a call is no longer possible.
   *
   * It tracks array identity, not contents, which is why mutations must
   * assign new `blocks` arrays rather than editing them in place.
   */
  watch() {
    for (const l of contentManager.layers) {
      void l.blocks;
      void l.blocks.length;
      void l.visible;
    }
    void contentManager.page.width;
    void contentManager.page.height;
    void contentManager.zoom;
    void contentManager.panX;
    void contentManager.panY;
    void this.width;
    void this.height;
    void this.dpr;
    void lassoManager.selectedIds;
    void textEditor.hiddenId;
    void tabManager.note.assets;
    requestRedraw();
  }

  /** The visible area in content space. */
  viewBounds(): ContentBounds {
    const tl = this.translateToRelative(0, 0);
    const br = this.translateToRelative(this.width, this.height);
    return boundsFromRect(tl.x, tl.y, br.x - tl.x, br.y - tl.y);
  }

  private paint() {
    const page = contentManager.page;
    const assets = tabManager.note.assets;
    const view = this.viewBounds();
    const clip = pageRect(page);

    const skip = new Set(lassoManager.selectedIds);
    if (textEditor.hiddenId) skip.add(textEditor.hiddenId);

    for (const l of page.layers) {
      const ctx = this.layerCtx[l.id];
      if (!ctx) continue;

      ctx.resetTransform();
      ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
      if (!l.visible) continue;

      ctx.save();
      ctx.scale(this.dpr, this.dpr);
      ctx.translate(this.width / 2, this.height / 2);
      ctx.scale(contentManager.zoom, contentManager.zoom);
      ctx.translate(contentManager.panX, contentManager.panY);

      // On a fixed page, ink past the edge is kept but not shown, like paper.
      if (clip) {
        ctx.beginPath();
        ctx.rect(clip.min.x, clip.min.y, clip.width, clip.height);
        ctx.clip();
      }

      drawBlocks(ctx, l.blocks, assets, view, skip);
      ctx.restore();
    }
  }

  /**
   * Drops cached outlines/bounds for blocks that no longer exist anywhere:
   * in any page of any open tab. (Scoping this to the active page used to
   * throw away the cache of every other page and tab on each undo.)
   */
  cleanCache() {
    const live = new Set<string>();
    for (const tab of tabManager.tabs)
      for (const page of tab.note.content.pages)
        for (const l of page.layers) for (const b of l.blocks) live.add(b.id);

    pruneBlockCaches(live);
  }

  assignContext(element: HTMLCanvasElement, id: string) {
    const ctx = element.getContext("2d");
    if (ctx) {
      this.layerCtx[id] = ctx;
      requestRedraw();
    }
    return {
      destroy: () => {
        if (this.layerCtx[id]?.canvas === element) delete this.layerCtx[id];
      },
    };
  }

  // ------------------------------------------------------------ coordinates

  translateToRelative(x: number, y: number, pressure: number = 0.5) {
    x = x - this.width / 2;
    y = y - this.height / 2;

    x = x / contentManager.zoom;
    y = y / contentManager.zoom;

    x = x - contentManager.panX;
    y = y - contentManager.panY;

    return { x, y, pressure };
  }

  translateToAbsolute(p: Point2D): Point2D {
    return {
      x: (p.x + contentManager.panX) * contentManager.zoom + this.width / 2,
      y: (p.y + contentManager.panY) * contentManager.zoom + this.height / 2,
    };
  }

  /** Pans by a screen-pixel delta. */
  panBy(dx: number, dy: number) {
    contentManager.panX += dx / contentManager.zoom;
    contentManager.panY += dy / contentManager.zoom;
    this.clampPan();
  }

  zoomAround(x: number, y: number, factor: number) {
    const before = this.translateToRelative(x, y);

    contentManager.zoom *= factor;

    const z = contentManager.zoom;
    contentManager.panX = (x - this.width / 2) / z - before.x;
    contentManager.panY = (y - this.height / 2) / z - before.y;
    this.clampPan();
  }

  /**
   * Keeps a fixed-size page from being panned out of sight. Infinite pages
   * are left alone; "Fit" is the way back there.
   */
  clampPan() {
    const page = contentManager.page;
    if (isInfinite(page) || this.width === 0) return;

    const z = contentManager.zoom;
    const keep = KEEP_VISIBLE / z;
    const hx = this.width / 2 / z;
    const hy = this.height / 2 / z;

    // The content point at the centre of the screen is (-panX, -panY).
    const cx = clamp(-contentManager.panX, keep - hx, page.width + hx - keep);
    const cy = clamp(-contentManager.panY, keep - hy, page.height + hy - keep);
    contentManager.panX = -cx;
    contentManager.panY = -cy;
  }

  /**
   * Fits the current page into the view: a tall page is fitted to the width
   * and shown from the top, a wide one is shown whole. An infinite page is
   * fitted to its content (or reset to the origin when empty).
   */
  fitPage() {
    if (this.width === 0 || this.height === 0) return;
    const page = contentManager.page;
    const r = pageExtent(page);

    if (!r || r.width === 0 || r.height === 0) {
      contentManager.zoom = 1;
      contentManager.panX = 0;
      contentManager.panY = 0;
      return;
    }

    const zoomW = (this.width - FIT_MARGIN * 2) / r.width;
    const zoomH = (this.height - FIT_MARGIN * 2) / r.height;
    const tall = !isInfinite(page) && r.height > r.width && zoomW < zoomH * 2;

    const z = tall
      ? Math.min(zoomW, MAX_FIT_ZOOM)
      : Math.min(zoomW, zoomH, isInfinite(page) ? 1 : MAX_FIT_ZOOM);
    contentManager.zoom = z;

    contentManager.panX = -(r.min.x + r.width / 2);
    contentManager.panY =
      tall && r.height * z > this.height
        ? (FIT_MARGIN - this.height / 2) / contentManager.zoom - r.min.y
        : -(r.min.y + r.height / 2);
  }

  // ------------------------------------------------------------------ tools

  get tool() {
    return this.#tool;
  }

  set tool(tool: Tool) {
    if (this.#tool === tool) return;

    tabManager.transact("Switch tool", () => {
      if (this.#tool === "lasso") lassoManager.reset();
      else if (tool === "lasso") lassoManager.isSelecting = true;
      if (this.#tool === "text") textEditor.commit();

      this.#tool = tool;
    });
  }

  /** Size of the active tool (stroke width, eraser radius or font size). */
  get size() {
    return this.sizes[this.#tool];
  }

  set size(v: number) {
    this.sizes[this.#tool] = v;
  }

  /** Width of the stroke being drawn, in content units. */
  get thickness() {
    const t = this.sizes[this.#tool];
    return this.zoomLock ? t : t / contentManager.zoom;
  }

  get eraserRadius() {
    return this.sizes.eraser;
  }

  get opacity() {
    return toolDef(this.#tool).opacity ?? 1;
  }

  // ------------------------------------------------------------------ input

  addPoint(p: Point) {
    const last = this.points[this.points.length - 1];
    if (!last || last.x !== p.x || last.y !== p.y) this.points.push(p);
  }

  eraseAlong(from: Point2D, to: Point2D) {
    const dx = to.x - from.x;
    const dy = to.y - from.y;

    const steps = Math.max(
      1,
      Math.ceil(Math.hypot(dx, dy) / (this.eraserRadius / 2)),
    );

    for (let i = 1; i <= steps; i++) {
      const t = i / steps;
      this.eraser({ x: from.x + dx * t, y: from.y + dy * t });
    }
  }

  /** Cuts strokes under the eraser. Text and images are removed with the lasso. */
  eraser(p: Point2D) {
    const r = this.eraserRadius;

    for (const l of contentManager.layers) {
      if (l.locked || !l.visible) continue;

      let changed = false;
      const blocks = l.blocks.flatMap((b): Block[] => {
        if (b.type !== "Stroke") return [b];
        if (b.points.length === 0) {
          changed = true;
          return [];
        }

        const bounds = blockBounds(b);
        if (bounds && !circleIntersectsBounds(p, r, bounds)) return [b];

        const pieces = erase(b.points, p, r);
        // One piece with every point means the eraser missed.
        if (pieces.length === 1 && pieces[0].length === b.points.length)
          return [b];

        changed = true;
        return pieces.map((points) => ({ ...b, id: newId(), points }));
      });

      if (changed) l.blocks = blocks;
    }
  }

  finishStroke() {
    const points = $state.snapshot(this.points);
    this.points = [];
    if (points.length === 0) return;

    const layer = contentManager.layers[contentManager.activeLayer];
    if (!layer) return;
    if (layer.locked || !layer.visible) {
      popupManager.add({
        type: "warning",
        message: `"${layer.name}" is ${layer.locked ? "locked" : "hidden"}.`,
      });
      return;
    }

    layer.blocks = [
      ...layer.blocks,
      {
        type: "Stroke",
        id: newId(),
        color: this.color,
        thickness: this.thickness,
        opacity: this.opacity,
        points,
      },
    ];
  }
}

function clamp(v: number, lo: number, hi: number) {
  return lo > hi ? (lo + hi) / 2 : Math.min(Math.max(v, lo), hi);
}

export const canvasManager = new CanvasManager();

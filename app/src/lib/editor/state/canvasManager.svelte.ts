import { contentManager } from "#lib/state/contentManager.svelte.ts";
import { popupManager } from "#lib/state/popupManager.svelte.ts";
import { settingsStore } from "#lib/state/settingsStore.svelte.ts";
import { tabManager } from "#lib/state/tabManager.svelte.ts";
import type { Block, Point } from "#lib/tauri/bindings.ts";
import {
  boundsFromRect,
  circleIntersectsBounds,
  type ContentBounds,
  type Point2D,
} from "#lib/util/canvasBounds.ts";
import { blockBounds, newId, pruneBlockCaches, type StrokeBlock } from "../blocks";
import { isInfinite, pageExtent, pageRect } from "../pageFormats";
import { drawBlocks } from "../render/draw";
import { onPaint, requestRedraw } from "../render/scheduler";
import {
  defaultColors,
  defaultSizes,
  toolDef,
  type Tool,
} from "../tools/registry";
import { erase } from "../tools/erase";
import { centerLine } from "../svg";
import { lassoManager } from "./lassoManager.svelte";
import { textEditor } from "./textEditor.svelte";

export type { Tool } from "../tools/registry";

/** A block as the eraser sees it, read once per gesture. */
interface EraseEntry {
  block: Block;
  stroke?: StrokeBlock;
  bounds: ContentBounds | null;
  /** The centre line to cut, filled in when the eraser first gets near. */
  line?: Point[];
}

function eraseEntry(block: Block): EraseEntry {
  const stroke = block.type === "Stroke" ? block : undefined;
  return { block, stroke, bounds: blockBounds(block) };
}

/** Screen pixels kept free around a page when fitting it to the view. */
const FIT_MARGIN = 32;
/** Room for a floating bar (toolbar, or the page/zoom controls at the bottom). */
const BAR_MARGIN = 88;
/** Never zoom past this when fitting a page; huge zoom on a big screen is unpleasant. */
const MAX_FIT_ZOOM = 1.6;
/** Screen pixels of a fixed page that always stay on screen while panning. */
const KEEP_VISIBLE = 64;

class CanvasManager {
  #tool = $state<Tool>("pen");
  lockTool = $state(false);
  /** When on, stroke width is in page units and grows with zoom (like paper). */
  zoomLock = $state(true);
  /** A tool used only while a pen button is held (the eraser end). */
  heldTool = $state<Tool>();
  /** The tool to go back to after a barrel-button lasso. */
  #returnTo: Tool | undefined;

  /** Selected colour per tool, so pen and highlighter each keep their own. */
  colors = $state(defaultColors());
  /** Per-tool size: stroke width, eraser radius or font size. */
  sizes = $state<Record<Tool, number>>(defaultSizes());

  /** "partial" cuts away what the eraser covers; "stroke" removes whole strokes it touches. */
  eraserMode = $state<"partial" | "stroke">("partial");

  drawing = $state(false);
  points = $state<Point[]>([]);

  /*
   * While the eraser is down, each touched layer's blocks live here as plain
   * arrays and are painted from here; `finishErasing` assigns them to the
   * note once. Assigning to the note's deep state on every move used to
   * proxy every new piece, snapshot the note and re-render its thumbnail per
   * step, which is what made erasing lag.
   */
  #erasing = new Map<string, { entries: EraseEntry[]; blocks?: Block[] }>();

  width = $state(0);
  height = $state(0);
  layerCtx: Record<string, CanvasRenderingContext2D> = {};

  dpr = $state(typeof window !== "undefined" ? window.devicePixelRatio : 1);

  /** A pen or mouse gesture is in progress on the canvas. */
  gesture = $state(false);

  constructor() {
    onPaint(() => this.paint());

    // A barrel-button lasso hands back the previous tool once nothing is
    // selected, however the selection ended: Delete in its menu, Escape,
    // undo or a tab switch, not only a tap on the canvas. Checking only after
    // canvas gestures left it in lasso, so the next stroke drew a loop.
    // Never mid-gesture: a tap outside a selection clears it on pen-down.
    $effect.root(() => {
      $effect(() => {
        if (!this.gesture && !lassoManager.selection) this.returnFromTemporaryTool();
      });
    });
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
    const assets = contentManager.assets;
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
      this.#toContent(ctx);

      // On a fixed page, ink past the edge is kept but not shown, like paper.
      if (clip) {
        ctx.beginPath();
        ctx.rect(clip.min.x, clip.min.y, clip.width, clip.height);
        ctx.clip();
      }

      drawBlocks(ctx, this.#erasing.get(l.id)?.blocks ?? l.blocks, assets, view, skip);
      ctx.restore();
    }

    // The selection, on its own canvas above the layers. Dragging moves that
    // canvas with a CSS transform, so a drag repaints nothing. (It used to be
    // one SVG component per selected block, rebuilt on every drop.) Not
    // culled or clipped, so what is dragged in from off screen is there.
    const sel = this.selectionCtx;
    if (sel) {
      sel.resetTransform();
      sel.clearRect(0, 0, sel.canvas.width, sel.canvas.height);
      const selected = Object.values(lassoManager.selection ?? {}).flatMap((e) =>
        e.map((s) => s.block),
      );
      if (selected.length) {
        this.#toContent(sel);
        const hidden = textEditor.hiddenId ? new Set([textEditor.hiddenId]) : undefined;
        drawBlocks(sel, selected, assets, undefined, hidden);
      }
    }
  }

  /** Sets up a canvas to draw in content coordinates at the current view. */
  #toContent(ctx: CanvasRenderingContext2D) {
    ctx.scale(this.dpr, this.dpr);
    ctx.translate(this.width / 2, this.height / 2);
    ctx.scale(contentManager.zoom, contentManager.zoom);
    ctx.translate(contentManager.panX, contentManager.panY);
  }

  selectionCtx: CanvasRenderingContext2D | undefined;

  assignSelectionContext = (element: HTMLCanvasElement) => {
    this.selectionCtx = element.getContext("2d") ?? undefined;
    requestRedraw();
    return {
      destroy: () => {
        if (this.selectionCtx?.canvas === element) this.selectionCtx = undefined;
      },
    };
  };

  /** While something is selected with the lasso, the rest of the page fades. */
  get dimmed() {
    return this.#tool === "lasso" && !!lassoManager.selection;
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

    const m = this.insets();
    const zoomW = (this.width - m.left - m.right) / r.width;
    const zoomH = (this.height - m.top - m.bottom) / r.height;
    const tall = !isInfinite(page) && r.height > r.width && zoomW < zoomH * 2;

    const z = tall
      ? Math.min(zoomW, MAX_FIT_ZOOM)
      : Math.min(zoomW, zoomH, isInfinite(page) ? 1 : MAX_FIT_ZOOM);
    contentManager.zoom = z;

    // Centre within the free area, which is off-centre when a bar takes one side.
    // The content point at screen x is: (x - width/2) / zoom - panX.
    contentManager.panX = (m.left - m.right) / 2 / z - (r.min.x + r.width / 2);
    contentManager.panY =
      tall && r.height * z > this.height - m.top - m.bottom
        ? (m.top - this.height / 2) / z - r.min.y
        : (m.top - m.bottom) / 2 / z - (r.min.y + r.height / 2);
  }

  /** Screen space to keep free on each side: the docked toolbar and the view controls. */
  private insets() {
    const dock = settingsStore.store.toolbar_dock;
    const side = (d: typeof dock) => (dock === d ? BAR_MARGIN : FIT_MARGIN);
    return {
      top: side("top"),
      // The zoom/page controls always sit at the bottom; a bottom toolbar sits above them.
      bottom: dock === "bottom" ? BAR_MARGIN * 2 : BAR_MARGIN,
      left: side("left"),
      right: side("right"),
    };
  }

  // ------------------------------------------------------------------ tools

  get tool() {
    return this.#tool;
  }

  /** The tool the next input uses: a held pen button wins over the selection. */
  get effectiveTool() {
    return this.heldTool ?? this.#tool;
  }

  /** Switches tools until `returnFromTemporaryTool` decides to switch back. */
  switchTemporarily(tool: Tool) {
    const previous = this.#tool;
    this.tool = tool;
    this.#returnTo = previous;
  }

  /**
   * After each gesture: a lasso picked with the barrel button stays while
   * something is selected (it is dragged with the tip), then hands back to
   * the tool that was in use before.
   */
  returnFromTemporaryTool() {
    if (!this.#returnTo || this.#tool !== "lasso" || lassoManager.selection) return;
    this.tool = this.#returnTo;
  }

  set tool(tool: Tool) {
    if (this.#tool === tool) return;

    // Any explicit choice ends a temporary switch.
    this.#returnTo = undefined;

    tabManager.transact("Switch tool", () => {
      if (this.#tool === "lasso") lassoManager.reset();
      else if (tool === "lasso") lassoManager.isSelecting = true;
      if (this.#tool === "text") textEditor.commit();

      this.#tool = tool;
    });
  }

  /** Colour of the active tool. */
  get color() {
    return this.colors[this.#tool] ?? "#000000";
  }

  set color(c: string) {
    this.colors[this.#tool] = c;
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

  /**
   * Cuts strokes under the eraser, or removes them whole in "stroke" mode.
   * Text and images are removed with the lasso. The result is kept until
   * `finishErasing` (see `#erasing`).
   */
  eraser(p: Point2D) {
    const r = this.eraserRadius;
    const whole = this.eraserMode === "stroke";

    for (const l of contentManager.layers) {
      if (l.locked || !l.visible) continue;

      // The layer's blocks are read through the note's proxies once per
      // gesture; every later step only touches this plain list.
      let work = this.#erasing.get(l.id);
      if (!work) {
        work = { entries: l.blocks.map(eraseEntry) };
        this.#erasing.set(l.id, work);
      }

      let changed = false;
      const next: EraseEntry[] = [];
      for (const e of work.entries) {
        const s = e.stroke;
        if (!s) {
          next.push(e);
          continue;
        }
        if (e.bounds && !circleIntersectsBounds(p, r, e.bounds)) {
          next.push(e);
          continue;
        }

        // Cut the line as drawn, not the raw input (see `centerLine`).
        e.line ??= s.smoothed ? s.points : centerLine(s.points, s.thickness);
        const pieces = e.line.length ? erase(e.line, p, r) : [];
        // One piece with every point means the eraser missed.
        if (pieces.length === 1 && pieces[0].length === e.line.length) {
          next.push(e);
          continue;
        }

        changed = true;
        if (whole) continue;
        for (const points of pieces)
          next.push(eraseEntry({ ...s, id: newId(), points, smoothed: true }));
      }

      if (changed) {
        work.entries = next;
        work.blocks = next.map((e) => e.block);
        requestRedraw();
      }
    }
  }

  /** Puts what the eraser left into the note, as one change. */
  finishErasing() {
    for (const l of contentManager.layers) {
      const blocks = this.#erasing.get(l.id)?.blocks;
      if (blocks) l.blocks = blocks;
    }
    this.#erasing.clear();
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

import { contentManager } from "#lib/state/contentManager.svelte.ts";
import { popupManager } from "#lib/state/popupManager.svelte.ts";
import { settingsStore } from "#lib/state/settingsStore.svelte.ts";
import { tabManager } from "#lib/state/tabManager.svelte.ts";
import type { Block, Point } from "#lib/tauri/bindings.ts";
import {
  boundsFromRect,
  circleIntersectsBounds,
  unionBounds,
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
  TOOL_IDS,
  toolDef,
  type Tool,
} from "../tools/registry";
import { erase } from "../tools/erase";
import { centerLine } from "../svg";
import { adaptInk, displayPaper, type PaperColors } from "../inkColor";
import { recognizeShape, shapePoints, snapLineEnd, type Shape } from "../shapes";
import { along, pointOn, type EdgeLine } from "../ruler";
import { rulerManager } from "./rulerManager.svelte";
import { PRESSURE_THINNING } from "../pressure";
import { lassoManager } from "./lassoManager.svelte";
import { loadWorkspace, saveWorkspace } from "./workspace";
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

/** Resting the pen this long (ms) at the end of a stroke snaps it to a shape. */
const HOLD_MS = 600;
/** ...as long as it stays within this many screen px. */
const HOLD_RADIUS = 4;
/** Strokes smaller than this on screen (px, bounding-box diagonal) never snap: handwriting. */
const MIN_SHAPE = 32;

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
  /**
   * The shape the stroke being drawn snapped to when the pen rested
   * (`shape_snap` setting); `points` then hold its outline. A line's end
   * keeps following the pen until it lifts.
   */
  shape = $state<Shape>();
  /** The ruler edge the stroke being drawn follows, and how far along it it reaches. */
  #edge: { line: EdgeLine; min: number; max: number } | undefined;
  #holdAnchor: Point2D | undefined;
  #holdTimer: ReturnType<typeof setTimeout> | undefined;

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
    onPaint((full) => this.paint(full));

    // Start where the last session left off (see workspace.ts).
    const w = loadWorkspace({ ids: TOOL_IDS, size: (t) => toolDef(t).size });
    if (w.tool) this.#tool = w.tool;
    Object.assign(this.colors, w.colors);
    Object.assign(this.sizes, w.sizes);
    if (w.eraserMode) this.eraserMode = w.eraserMode;
    if (w.zoomLock !== undefined) this.zoomLock = w.zoomLock;
    if (w.scaleWidths !== undefined) lassoManager.scaleWidths = w.scaleWidths;
    if (w.lassoMode) lassoManager.lassoMode = w.lassoMode;
    if (w.rotationLock !== undefined) lassoManager.rotationLock = w.rotationLock;

    $effect.root(() => {
      $effect(() => {
        const next = {
          // A barrel-button lasso is temporary: remember the tool under it.
          tool: this.#returnTo ?? this.#tool,
          colors: $state.snapshot(this.colors),
          sizes: $state.snapshot(this.sizes),
          eraserMode: this.eraserMode,
          zoomLock: this.zoomLock,
          scaleWidths: lassoManager.scaleWidths,
          lassoMode: lassoManager.lassoMode,
          rotationLock: lassoManager.rotationLock,
        };
        // Sliders change sizes many times a second; write once they settle.
        const timer = setTimeout(() => saveWorkspace(next), 500);
        return () => clearTimeout(timer);
      });
    });

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
    void this.paperShown.background;
    requestRedraw();
  }

  /** The current page's paper as shown (the "Dark pages" setting may darken it). */
  get paperShown(): PaperColors {
    const p = contentManager.page;
    return displayPaper(p.background_color, p.pattern_color, settingsStore.store.dark_pages);
  }

  /** How ink of `color` is shown on the current page (see inkColor.ts). */
  inkShown(color: string): string {
    return adaptInk(color, this.paperShown.background);
  }

  /** The visible area in content space. */
  viewBounds(): ContentBounds {
    const tl = this.translateToRelative(0, 0);
    const br = this.translateToRelative(this.width, this.height);
    return boundsFromRect(tl.x, tl.y, br.x - tl.x, br.y - tl.y);
  }

  private paint(full = true) {
    const page = contentManager.page;
    const assets = contentManager.assets;
    const view = this.viewBounds();
    const clip = pageRect(page);

    // The eraser only changes ink where it is: unless something else asked
    // for a full repaint this frame, redraw just that area of the layers it
    // touched, so erasing costs the same on a full page as on an empty one.
    const area = full ? undefined : this.#dirty;
    const touched = this.#dirtyLayers;
    this.#dirty = undefined;
    this.#dirtyLayers = new Set();

    const skip = new Set(lassoManager.selectedIds);
    if (textEditor.hiddenId) skip.add(textEditor.hiddenId);
    const paper = this.paperShown.background;
    const ink = (c: string) => adaptInk(c, paper);

    for (const l of page.layers) {
      const ctx = this.layerCtx[l.id];
      if (!ctx) continue;
      if (area && !touched.has(l.id)) continue;

      ctx.resetTransform();
      if (!area) ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
      ctx.save();
      ctx.scale(this.dpr, this.dpr);
      if (area) {
        const r = this.#screenRect(area);
        ctx.beginPath();
        ctx.rect(r.x, r.y, r.w, r.h);
        ctx.clip();
        ctx.clearRect(r.x, r.y, r.w, r.h);
      }
      if (!l.visible) {
        ctx.restore();
        continue;
      }
      this.#viewTransform(ctx);

      // On a fixed page, ink past the edge is kept but not shown, like paper.
      if (clip) {
        ctx.beginPath();
        ctx.rect(clip.min.x, clip.min.y, clip.width, clip.height);
        ctx.clip();
      }

      const blocks = this.#erasing.get(l.id)?.blocks ?? l.blocks;
      drawBlocks(ctx, blocks, assets, area ?? view, skip, ink);
      ctx.restore();
    }
    if (area) return; // the selection did not change

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
        drawBlocks(sel, selected, assets, undefined, hidden, ink);
      }
    }
  }

  /** Sets up a canvas to draw in content coordinates at the current view. */
  #toContent(ctx: CanvasRenderingContext2D) {
    ctx.scale(this.dpr, this.dpr);
    this.#viewTransform(ctx);
  }

  /** From CSS pixels to content coordinates. */
  #viewTransform(ctx: CanvasRenderingContext2D) {
    ctx.translate(this.width / 2, this.height / 2);
    ctx.scale(contentManager.zoom, contentManager.zoom);
    ctx.translate(contentManager.panX, contentManager.panY);
  }

  /** A content area on screen, in CSS pixels, rounded outwards with a margin for anti-aliasing. */
  #screenRect(b: ContentBounds) {
    const tl = this.translateToAbsolute(b.min);
    const br = this.translateToAbsolute(b.max);
    const x = Math.floor(tl.x) - 2;
    const y = Math.floor(tl.y) - 2;
    return { x, y, w: Math.ceil(br.x) - x + 2, h: Math.ceil(br.y) - y + 2 };
  }

  /** Area the eraser changed since the last paint, and on which layers. */
  #dirty: ContentBounds | undefined;
  #dirtyLayers = new Set<string>();

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

  /** Sets the zoom exactly (1 = 100 %), keeping the middle of the view in place. */
  zoomTo(zoom: number) {
    this.zoomAround(this.width / 2, this.height / 2, zoom / contentManager.zoom);
    contentManager.zoom = zoom; // no rounding drift from the multiplication
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
    const t = this.sizes[this.effectiveTool];
    return this.zoomLock ? t : t / contentManager.zoom;
  }

  /*
   * The stroke being drawn uses the tool doing the drawing: a highlighter
   * held on the barrel button draws with the highlighter's colour, width and
   * opacity, not the pen's. (`color` and `size` stay with the selected tool:
   * they are what the toolbar shows and changes.)
   */
  /** Colour of the stroke being drawn. */
  get inkColor() {
    return this.colors[this.effectiveTool] ?? "#000000";
  }

  /** Pressure response of the stroke being drawn: the pen's setting; even for the highlighter. */
  get thinning() {
    return this.effectiveTool === "pen" ? PRESSURE_THINNING[settingsStore.store.pen_pressure] : 0;
  }

  get eraserRadius() {
    return this.sizes.eraser;
  }

  get opacity() {
    return toolDef(this.effectiveTool).opacity ?? 1;
  }

  // ------------------------------------------------------------------ input

  addPoint(p: Point) {
    // A stroke starting on or next to the ruler runs along its edge.
    if (!this.points.length) {
      const line = rulerManager.edgeAt(p, this.thickness);
      const t = line && along(line, p);
      this.#edge = line && { line, min: t!, max: t! };
    }
    if (this.#edge) {
      const e = this.#edge;
      const t = along(e.line, p);
      e.min = Math.min(e.min, t);
      e.max = Math.max(e.max, t);
      this.shape = { kind: "line", from: pointOn(e.line, e.min), to: pointOn(e.line, e.max) };
      this.points = shapePoints(this.shape);
      return;
    }
    if (this.shape) {
      if (this.shape.kind === "line") {
        this.shape = { ...this.shape, to: snapLineEnd(this.shape.from, p) };
        this.points = shapePoints(this.shape);
      }
      return;
    }
    const last = this.points[this.points.length - 1];
    if (!last || last.x !== p.x || last.y !== p.y) this.points.push(p);
    this.#watchHold(p);
  }

  /** Restarts the hold timer whenever the pen moves more than a few pixels. */
  #watchHold(p: Point2D) {
    if (!settingsStore.store.shape_snap) return;
    const a = this.#holdAnchor;
    if (a && Math.hypot(p.x - a.x, p.y - a.y) * contentManager.zoom <= HOLD_RADIUS) return;
    this.#holdAnchor = { x: p.x, y: p.y };
    clearTimeout(this.#holdTimer);
    this.#holdTimer = setTimeout(() => this.#snapToShape(), HOLD_MS);
  }

  #snapToShape() {
    if (!this.drawing || this.shape) return;
    const pts = $state.snapshot(this.points);
    const xs = pts.map((q) => q.x);
    const ys = pts.map((q) => q.y);
    const size = Math.hypot(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys));
    if (size * contentManager.zoom < MIN_SHAPE) return;
    const shape = recognizeShape(pts);
    if (!shape) return;
    this.shape = shape;
    this.points = shapePoints(shape);
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
    // Set when a change has no bounds (an empty stroke): repaint everything.
    let fullRepaint = false;

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
        // The pieces lie within the stroke's bounds, so those cover the change.
        if (e.bounds) this.#dirty = this.#dirty ? unionBounds(this.#dirty, e.bounds) : e.bounds;
        else fullRepaint = true;
        if (whole) continue;
        for (const points of pieces)
          next.push(eraseEntry({ ...s, id: newId(), points, smoothed: true }));
      }

      if (changed) {
        work.entries = next;
        work.blocks = next.map((e) => e.block);
        this.#dirtyLayers.add(l.id);
      }
    }
    if (this.#dirtyLayers.size) requestRedraw(!fullRepaint);
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
    const shape = this.shape;
    this.points = [];
    this.shape = undefined;
    this.#edge = undefined;
    clearTimeout(this.#holdTimer);
    this.#holdAnchor = undefined;
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
        color: this.inkColor,
        thickness: this.thickness,
        opacity: this.opacity,
        points,
        // A shape is its own clean outline, drawn as it is, at an even width.
        ...(shape ? { smoothed: true } : {}),
        // Stored with the stroke, so a later change of the setting keeps it.
        ...(this.thinning && !shape ? { thinning: this.thinning } : {}),
      },
    ];
  }
}

function clamp(v: number, lo: number, hi: number) {
  return lo > hi ? (lo + hi) / 2 : Math.min(Math.max(v, lo), hi);
}

export const canvasManager = new CanvasManager();

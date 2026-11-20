<script lang="ts">
  import { emitTo, listen } from "@tauri-apps/api/event";
  import { getCurrentWindow } from "@tauri-apps/api/window";
  import { onMount } from "svelte";
  import { pageRect } from "#lib/editor/pageFormats.ts";
  import { drawBlocks, drawPaper } from "#lib/editor/render/draw.ts";
  import { loadImage } from "#lib/editor/render/images.ts";
  import { pageArea } from "#lib/editor/render/page.ts";
  import { inputToPath } from "#lib/editor/svg.ts";
  import {
    PRESENT_EVENT,
    READY_EVENT,
    type LaserStroke,
    type PresentMessage,
    type ViewMode,
  } from "#lib/present/protocol.ts";
  import type { Page, Point } from "#lib/tauri/bindings.ts";
  import { boundsFromRect, type ContentBounds } from "#lib/util/canvasBounds.ts";

  /*
   * The audience view: only the page, drawn with the same renderer as the
   * editor, no UI and no cursor. It keeps no note of its own; everything comes
   * from the editor as messages (see present/protocol.ts). Escape closes it.
   */

  const MARGIN = 32;
  const LASER_WIDTH = 6; // screen pixels

  let canvas = $state<HTMLCanvasElement>();
  let page: Page | undefined;
  const assets: Record<string, string> = {};
  let view = { zoom: 1, panX: 0, panY: 0, width: 1, height: 1 };
  let ink: { points: Point[]; color: string; thickness: number; opacity: number } | undefined;
  let laser: LaserStroke[] = [];
  let mode: ViewMode = "fit";
  let blank = $state(false);

  let frame = 0;
  function redraw() {
    if (!frame) frame = requestAnimationFrame(paint);
  }

  /** The content area to show: the page (fit) or what the presenter sees (follow). */
  function shownArea(p: Page): ContentBounds | null {
    if (mode === "follow") {
      const w = view.width / view.zoom;
      const h = view.height / view.zoom;
      return boundsFromRect(-view.panX - w / 2, -view.panY - h / 2, w, h);
    }
    return pageArea(p);
  }

  function paint() {
    frame = 0;
    const c = canvas;
    const ctx = c?.getContext("2d");
    if (!c || !ctx) return;

    const dpr = window.devicePixelRatio;
    const W = c.clientWidth;
    const H = c.clientHeight;
    if (c.width !== Math.round(W * dpr)) c.width = Math.round(W * dpr);
    if (c.height !== Math.round(H * dpr)) c.height = Math.round(H * dpr);

    ctx.resetTransform();
    ctx.fillStyle = getComputedStyle(c).getPropertyValue("--base-3") || "#11111b";
    ctx.fillRect(0, 0, c.width, c.height);
    if (blank || !page) {
      ctx.fillStyle = "#000000";
      if (blank) ctx.fillRect(0, 0, c.width, c.height);
      return;
    }

    const area = shownArea(page) ?? boundsFromRect(-400, -300, 800, 600);
    const margin = mode === "fit" ? MARGIN : 0;
    const k = Math.min((W - 2 * margin) / area.width, (H - 2 * margin) / area.height);
    ctx.scale(dpr, dpr);
    ctx.translate(W / 2, H / 2);
    ctx.scale(k, k);
    ctx.translate(-(area.min.x + area.width / 2), -(area.min.y + area.height / 2));

    // Paper only on the sheet (or everywhere on an infinite page).
    const sheet = pageRect(page);
    const cx = area.min.x + area.width / 2;
    const cy = area.min.y + area.height / 2;
    const visible = boundsFromRect(cx - W / k / 2, cy - H / k / 2, W / k, H / k);
    drawPaper(ctx, page, sheet ?? visible, assets, k);

    ctx.save();
    if (sheet) {
      ctx.beginPath();
      ctx.rect(sheet.min.x, sheet.min.y, sheet.width, sheet.height);
      ctx.clip();
    }
    for (const l of page.layers) if (l.visible) drawBlocks(ctx, l.blocks, assets);

    if (ink && ink.points.length) {
      ctx.globalAlpha = ink.opacity;
      ctx.fillStyle = ink.color;
      ctx.fill(new Path2D(inputToPath(ink.points, ink.thickness, true)));
      ctx.globalAlpha = 1;
    }
    ctx.restore();

    // Laser: a bright red trail with a soft glow, constant width on screen.
    const red = getComputedStyle(c).getPropertyValue("--destructive") || "#f38ba8";
    for (const s of laser) {
      ctx.globalAlpha = s.opacity;
      ctx.shadowColor = red;
      ctx.shadowBlur = 12;
      ctx.fillStyle = red;
      ctx.fill(new Path2D(inputToPath(s.points, LASER_WIDTH / k, false)));
    }
    ctx.globalAlpha = 1;
    ctx.shadowBlur = 0;
  }

  function receive(msg: PresentMessage) {
    switch (msg.kind) {
      case "page":
        page = msg.page;
        break;
      case "assets":
        Object.assign(assets, msg.assets);
        // Decode before the next paint so images do not pop in a frame late.
        Promise.all(Object.entries(msg.assets).map(([id, src]) => loadImage(id, src))).then(redraw);
        break;
      case "view":
        view = msg;
        break;
      case "ink":
        ink = msg;
        break;
      case "laser":
        laser = msg.strokes;
        break;
      case "state":
        mode = msg.mode;
        blank = msg.blank;
        break;
    }
    redraw();
  }

  onMount(() => {
    let unlisten: (() => void) | undefined;
    (async () => {
      unlisten = await listen<PresentMessage>(PRESENT_EVENT, (e) => receive(e.payload));
      // Ask the editor for everything now that we can hear it.
      await emitTo("main", READY_EVENT);
    })();

    const resize = new ResizeObserver(redraw);
    if (canvas) resize.observe(canvas);

    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") getCurrentWindow().close();
    };
    window.addEventListener("keydown", key);

    return () => {
      unlisten?.();
      resize.disconnect();
      window.removeEventListener("keydown", key);
    };
  });
</script>

<svelte:head><title>RedNotes Plus — Audience</title></svelte:head>

<div class={["fixed inset-0 cursor-none", blank ? "bg-black" : "bg-base-3"]}>
  <canvas bind:this={canvas} class="w-full h-full block"></canvas>
</div>

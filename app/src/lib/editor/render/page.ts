import type { NoteData, Page } from "$lib/tauri/bindings";
import { padBounds, type ContentBounds } from "$lib/util/canvasBounds";
import { contentBounds, pageRect } from "../pageFormats";
import { drawBlocks, drawPaper, type Assets } from "./draw";
import { loadImage } from "./images";

/** Margin around the drawing when exporting an infinite page. */
const CONTENT_MARGIN = 24;

/**
 * The area of a page that gets rendered: the sheet for a fixed page, the
 * drawing plus a margin for an infinite one, or `null` for an empty
 * infinite page.
 */
export function renderArea(page: Page): ContentBounds | null {
  const rect = pageRect(page);
  if (rect) return rect;
  const content = contentBounds(page.layers);
  return content ? padBounds(content, CONTENT_MARGIN) : null;
}

/** Decodes every image the page uses, so the render is complete. */
async function preload(page: Page, assets: Assets) {
  const ids = new Set<string>();
  if (page.background_asset) ids.add(page.background_asset);
  for (const l of page.layers)
    for (const b of l.blocks) if (b.type === "Image") ids.add(b.asset);
  await Promise.all([...ids].map((id) => loadImage(id, assets[id])));
}

export interface RenderOptions {
  /** Output pixels per content unit. */
  scale?: number;
  /** Alternatively: fit the longest edge into this many pixels. */
  maxSize?: number;
}

/**
 * Renders a page (paper, background and all visible layers) onto a new
 * canvas. Used for thumbnails, PNG and PDF export, so all three match the
 * editor exactly.
 */
export async function renderPage(
  page: Page,
  assets: Assets,
  { scale, maxSize }: RenderOptions = {},
): Promise<HTMLCanvasElement | null> {
  const area = renderArea(page);
  if (!area) return null;

  await preload(page, assets);

  const k = maxSize ? maxSize / Math.max(area.width, area.height) : (scale ?? 1);
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(area.width * k));
  canvas.height = Math.max(1, Math.round(area.height * k));

  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  ctx.scale(k, k);
  ctx.translate(-area.min.x, -area.min.y);
  drawPaper(ctx, page, area, assets, k);
  for (const l of page.layers)
    if (l.visible) drawBlocks(ctx, l.blocks, assets);

  return canvas;
}

/** Longest edge of the preview stored in each file, in pixels. */
const PREVIEW_SIZE = 360;

/**
 * A PNG data URL of the note's first page, stored in the file so the explorer
 * can show it without opening the note. `null` for an empty infinite page.
 * Never throws: a missing preview must not stop a save.
 */
export async function notePreview(note: NoteData): Promise<string | null> {
  try {
    const page = note.content.pages[0];
    const canvas = page && (await renderPage(page, note.assets, { maxSize: PREVIEW_SIZE }));
    return canvas ? canvas.toDataURL("image/png") : null;
  } catch {
    return null;
  }
}

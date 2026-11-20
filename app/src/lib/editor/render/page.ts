import type { NoteData, Page } from "#lib/tauri/bindings.ts";
import { boundsFromRect, padBounds, type ContentBounds } from "#lib/util/canvasBounds.ts";
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
export function pageArea(page: Page): ContentBounds | null {
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

export interface AreaOptions {
  /** Output size in pixels; the area is stretched to it (keep the ratio). */
  width: number;
  height: number;
  /** Draw paper colour, ruling and PDF background. Off: transparent. */
  paper?: boolean;
  /** Fill colour used when `paper` is off (JPEG/PDF have no transparency). */
  fill?: string;
  /** Only draw blocks with these ids (e.g. an exported selection). */
  only?: Set<string>;
}

/**
 * Renders an arbitrary rectangle of a page. Ink is clipped to the sheet on a
 * fixed-size page, exactly like the editor shows it.
 */
export async function renderArea(
  page: Page,
  assets: Assets,
  area: ContentBounds,
  { width, height, paper = true, fill, only }: AreaOptions,
): Promise<HTMLCanvasElement | null> {
  await preload(page, assets);

  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(width));
  canvas.height = Math.max(1, Math.round(height));
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  if (!paper && fill) {
    ctx.fillStyle = fill;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }

  const kx = canvas.width / area.width;
  const ky = canvas.height / area.height;
  ctx.scale(kx, ky);
  ctx.translate(-area.min.x, -area.min.y);

  // On a fixed page there is no paper beyond the sheet's edge.
  const sheet = pageRect(page);
  const paperArea = sheet ? intersect(area, sheet) : area;
  if (paper && paperArea) drawPaper(ctx, page, paperArea, assets, Math.min(kx, ky));

  if (sheet) {
    ctx.beginPath();
    ctx.rect(sheet.min.x, sheet.min.y, sheet.width, sheet.height);
    ctx.clip();
  }

  for (const l of page.layers) {
    if (!l.visible) continue;
    drawBlocks(ctx, only ? l.blocks.filter((b) => only.has(b.id)) : l.blocks, assets);
  }

  return canvas;
}

/**
 * Renders a whole page (paper, background and all visible layers) onto a new
 * canvas. Used for thumbnails, previews and export, so all of them match the
 * editor exactly.
 */
export async function renderPage(
  page: Page,
  assets: Assets,
  { scale, maxSize }: RenderOptions = {},
): Promise<HTMLCanvasElement | null> {
  const area = pageArea(page);
  if (!area) return null;

  const k = maxSize ? maxSize / Math.max(area.width, area.height) : (scale ?? 1);
  return renderArea(page, assets, area, {
    width: area.width * k,
    height: area.height * k,
  });
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

function intersect(a: ContentBounds, b: ContentBounds): ContentBounds | null {
  const x0 = Math.max(a.min.x, b.min.x);
  const y0 = Math.max(a.min.y, b.min.y);
  const x1 = Math.min(a.max.x, b.max.x);
  const y1 = Math.min(a.max.y, b.max.y);
  return x1 > x0 && y1 > y0 ? boundsFromRect(x0, y0, x1 - x0, y1 - y0) : null;
}

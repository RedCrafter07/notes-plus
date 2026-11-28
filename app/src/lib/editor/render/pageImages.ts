import type { Page } from "#lib/tauri/bindings.ts";
import type { Assets } from "./draw";
import { renderPage } from "./page";

/*
 * Rendered images of whole pages for scroll mode, where the pages around
 * the current one are shown as pictures (the current page alone is drawn
 * live). Rendered with the export/thumbnail code, so they look the same.
 *
 * Kept for the few most recently shown pages only, so scrolling through a
 * long lecture does not pile up page-sized bitmaps.
 */

/** Pages kept rendered. A view shows at most three or four at once. */
const KEEP = 6;
/** Longest edge of a render, in pixels; a page shown larger is scaled up a little. */
const MAX_PIXELS = 4096;
/** Scales are rounded to steps of this ratio, so zooming does not re-render every frame. */
const STEP = 1.25;

export interface PageImage {
  canvas: HTMLCanvasElement;
  /** What it was rendered for, see `imageKey`. */
  key: string;
}

const cache = new Map<Page, PageImage>();

/** The render scale (pixels per unit) for showing `page` at `zoom` on a `dpr` screen. */
export function imageScale(page: Pick<Page, "width" | "height">, zoom: number, dpr: number): number {
  const wanted = STEP ** Math.round(Math.log(zoom * dpr) / Math.log(STEP));
  return Math.min(wanted, MAX_PIXELS / Math.max(page.width, page.height));
}

export function imageKey(scale: number, look: string): string {
  return `${scale.toFixed(4)}|${look}`;
}

/** The cached image of `page`, whatever it was rendered for. */
export function cachedImage(page: Page): PageImage | undefined {
  const hit = cache.get(page);
  if (hit) {
    // Most recently used last.
    cache.delete(page);
    cache.set(page, hit);
  }
  return hit;
}

/** Renders `page` (a copy carrying the colours to show) and caches it under `key`. */
export async function renderImage(
  source: Page,
  shown: Page,
  assets: Assets,
  scale: number,
  key: string,
  invertBackground: boolean,
): Promise<PageImage | undefined> {
  const canvas = await renderPage(shown, assets, { scale, invertBackground });
  if (!canvas) return;
  canvas.style.width = "100%";
  canvas.style.height = "100%";
  canvas.style.display = "block";
  const image = { canvas, key };
  cache.delete(source);
  cache.set(source, image);
  while (cache.size > KEEP) cache.delete(cache.keys().next().value!);
  return image;
}

import type { Block, Page } from "#lib/tauri/bindings.ts";
import type { ContentBounds } from "#lib/util/canvasBounds.ts";
import { assertNever, blockVisibleIn } from "../blocks";
import { layoutText, textFont, TEXT_LINE_HEIGHT } from "../text";
import { getImage } from "./images";
import { PAGE_DATE } from "../pageDate";
import { strokePath } from "./strokes";

/*
 * Pure drawing functions. The caller sets up the context transform so that
 * one unit is one content-space unit; these never touch editor state. The
 * live editor, page thumbnails and export all draw through here, so what you
 * see is what you export.
 */

export type { Assets } from "../assets";
import type { Assets } from "../assets";

/** The colour to draw an ink colour in (adapted to dark paper, see inkColor.ts). */
export type InkColor = (color: string) => string;
const asIs: InkColor = (c) => c;

export function drawBlock(
  ctx: CanvasRenderingContext2D,
  b: Block,
  assets: Assets,
  ink: InkColor = asIs,
) {
  switch (b.type) {
    case "Stroke":
      ctx.globalAlpha = b.opacity;
      ctx.fillStyle = ink(b.color);
      ctx.fill(strokePath(b));
      ctx.globalAlpha = 1;
      return;
    case "Text": {
      const { lines } = layoutText(b.text, b.width, b.font_size);
      ctx.font = textFont(b.font_size);
      ctx.fillStyle = ink(b.color);
      ctx.textBaseline = "top";
      const lh = b.font_size * TEXT_LINE_HEIGHT;
      // Centre the glyphs vertically in each line box, like CSS does.
      const lead = (lh - b.font_size) / 2;
      lines.forEach((line, i) => ctx.fillText(line, b.x, b.y + lead + i * lh));
      return;
    }
    case "Image": {
      const img = getImage(b.asset, assets(b.asset));
      if (img) ctx.drawImage(img, b.x, b.y, b.width, b.height);
      return;
    }
    default:
      assertNever(b);
  }
}

/**
 * Draws blocks, skipping any outside `view` (viewport culling) and any whose
 * id is in `skip` (e.g. the lasso selection, which is drawn as an overlay).
 */
export function drawBlocks(
  ctx: CanvasRenderingContext2D,
  blocks: Block[],
  assets: Assets,
  view?: ContentBounds,
  skip?: Set<string>,
  ink?: InkColor,
) {
  for (const b of blocks) {
    if (skip?.has(b.id)) continue;
    if (view && !blockVisibleIn(b, view)) continue;
    drawBlock(ctx, b, assets, ink);
  }
}

/**
 * Fills the paper colour, background image and ruling inside `area`, and
 * the page's date in its top margin if `dateLabel` is given (see pageDate.ts).
 */
export function drawPaper(
  ctx: CanvasRenderingContext2D,
  page: Page,
  area: ContentBounds,
  assets: Assets,
  zoom = 1,
  dateLabel?: string,
) {
  ctx.fillStyle = page.background_color;
  ctx.fillRect(area.min.x, area.min.y, area.width, area.height);

  if (page.background_asset && page.width > 0) {
    const img = getImage(page.background_asset, assets(page.background_asset));
    if (img) ctx.drawImage(img, 0, 0, page.width, page.height);
  }

  if (dateLabel && page.width > 0) {
    ctx.save();
    ctx.fillStyle = PAGE_DATE.color;
    ctx.font = `${PAGE_DATE.size}px sans-serif`;
    ctx.textAlign = "right";
    ctx.fillText(dateLabel, page.width - PAGE_DATE.right, PAGE_DATE.top);
    ctx.restore();
  }

  const s = page.pattern_scale;
  if (!page.pattern || s <= 0) return;

  const x0 = Math.floor(area.min.x / s) * s;
  const y0 = Math.floor(area.min.y / s) * s;
  const line = 1 / zoom;

  ctx.save();
  ctx.beginPath();
  ctx.rect(area.min.x, area.min.y, area.width, area.height);
  ctx.clip();
  ctx.fillStyle = page.pattern_color;

  switch (page.pattern) {
    case "Lines":
      for (let y = y0; y <= area.max.y; y += s)
        ctx.fillRect(area.min.x, y, area.width, line);
      break;
    case "Squares":
      for (let y = y0; y <= area.max.y; y += s)
        ctx.fillRect(area.min.x, y, area.width, line);
      for (let x = x0; x <= area.max.x; x += s)
        ctx.fillRect(x, area.min.y, line, area.height);
      break;
    case "Dots": {
      const r = 1.5;
      ctx.beginPath();
      for (let y = y0; y <= area.max.y; y += s)
        for (let x = x0; x <= area.max.x; x += s) {
          ctx.moveTo(x + r, y);
          ctx.arc(x, y, r, 0, Math.PI * 2);
        }
      ctx.fill();
      break;
    }
    default:
      assertNever(page.pattern);
  }
  ctx.restore();
}

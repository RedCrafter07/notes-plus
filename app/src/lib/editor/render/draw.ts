import type { Block, Page } from "#lib/tauri/bindings.ts";
import type { ContentBounds } from "#lib/util/canvasBounds.ts";
import { assertNever, blockVisibleIn } from "../blocks";
import { layoutText, textFont, TEXT_LINE_HEIGHT } from "../text";
import { getImage } from "./images";
import { PAGE_DATE } from "../pageDate";
import { lineBand, paperGuides, paperTile } from "../paper";
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

  const tile = paperTile(page.pattern, page.pattern_scale);
  if (!tile) return;
  const line = 1 / zoom;
  const tx0 = Math.floor(area.min.x / tile.width) * tile.width;
  const ty0 = Math.floor(area.min.y / tile.height) * tile.height;

  ctx.save();
  ctx.beginPath();
  ctx.rect(area.min.x, area.min.y, area.width, area.height);
  ctx.clip();
  ctx.fillStyle = page.pattern_color;
  ctx.strokeStyle = page.pattern_color;
  ctx.lineWidth = line;

  for (let ty = ty0; ty <= area.max.y; ty += tile.height) {
    for (const r of tile.rules) ctx.fillRect(area.min.x, ty + r, area.width, line);
    if (tile.lines.length) {
      // Each tile draws its band of the lines, so none is drawn twice.
      ctx.beginPath();
      for (let tx = tx0 - tile.width; tx <= area.max.x + tile.width; tx += tile.width)
        for (const l of tile.lines) {
          const [x1, y1, x2, y2] = lineBand(l, 0, tile.height);
          ctx.moveTo(tx + x1, ty + y1);
          ctx.lineTo(tx + x2, ty + y2);
        }
      ctx.stroke();
    }
    if (tile.dots.length) {
      const r = 1.5;
      ctx.beginPath();
      for (let tx = tx0; tx <= area.max.x; tx += tile.width)
        for (const [dx, dy] of tile.dots) {
          ctx.moveTo(tx + dx + r, ty + dy);
          ctx.arc(tx + dx, ty + dy, r, 0, Math.PI * 2);
        }
      ctx.fill();
    }
  }
  for (const c of tile.columns)
    for (let tx = tx0; tx <= area.max.x; tx += tile.width) ctx.fillRect(tx + c, area.min.y, line, area.height);

  // Guides (Cornell, margin), stronger than the ruling.
  for (const g of paperGuides(page)) {
    ctx.lineWidth = g.weight * line;
    ctx.strokeStyle = g.color ?? page.pattern_color;
    ctx.beginPath();
    ctx.moveTo(g.x1, g.y1);
    ctx.lineTo(g.x2, g.y2);
    ctx.stroke();
  }
  ctx.restore();
}

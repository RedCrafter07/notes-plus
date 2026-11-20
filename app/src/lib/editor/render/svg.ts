import type { Block, Page } from "$lib/tauri/bindings";
import type { ContentBounds } from "$lib/util/canvasBounds";
import { assertNever } from "../blocks";
import { pageRect } from "../pageFormats";
import { inputToPath } from "../svg";
import { layoutText, TEXT_FONT_FAMILY, TEXT_LINE_HEIGHT } from "../text";
import type { Assets } from "./draw";

/*
 * Vector export. Mirrors `drawBlock`/`drawPaper` in draw.ts, but produces an
 * SVG document instead of pixels, so strokes stay sharp at any size and text
 * stays selectable. Images (and imported PDF pages) are embedded as-is.
 */

export interface SvgOptions {
  /** Draw paper colour, ruling and PDF background. Off: transparent. */
  paper?: boolean;
  /** Only include blocks with these ids. */
  only?: Set<string>;
}

const esc = (s: string) =>
  s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

const n = (v: number) => +v.toFixed(2);

function blockSvg(b: Block, assets: Assets): string {
  switch (b.type) {
    case "Stroke": {
      const opacity = b.opacity < 1 ? ` fill-opacity="${b.opacity}"` : "";
      return `<path d="${inputToPath(b.points, b.thickness, false)}" fill="${esc(b.color)}"${opacity}/>`;
    }
    case "Text": {
      const lh = b.font_size * TEXT_LINE_HEIGHT;
      const lines = layoutText(b.text, b.width, b.font_size).lines;
      const tspans = lines
        .map((line, i) => `<tspan x="${n(b.x)}" y="${n(b.y + i * lh + lh / 2)}">${esc(line)}</tspan>`)
        .join("");
      return (
        `<text dominant-baseline="central" xml:space="preserve" fill="${esc(b.color)}" ` +
        `font-size="${b.font_size}" font-family="${esc(TEXT_FONT_FAMILY)}">${tspans}</text>`
      );
    }
    case "Image": {
      const src = assets[b.asset];
      if (!src) return "";
      return `<image href="${src}" x="${n(b.x)}" y="${n(b.y)}" width="${n(b.width)}" height="${n(b.height)}" preserveAspectRatio="none"/>`;
    }
    default:
      return assertNever(b);
  }
}

function paperSvg(page: Page, area: ContentBounds, assets: Assets): string {
  const parts = [
    `<rect x="${n(area.min.x)}" y="${n(area.min.y)}" width="${n(area.width)}" height="${n(area.height)}" fill="${esc(page.background_color)}"/>`,
  ];

  const bg = page.background_asset && assets[page.background_asset];
  if (bg && page.width > 0)
    parts.push(`<image href="${bg}" x="0" y="0" width="${page.width}" height="${page.height}" preserveAspectRatio="none"/>`);

  const s = page.pattern_scale;
  const c = esc(page.pattern_color);
  let tile = "";
  switch (page.pattern) {
    case "Lines":
      tile = `<rect width="${s}" height="1" fill="${c}"/>`;
      break;
    case "Squares":
      tile = `<rect width="${s}" height="1" fill="${c}"/><rect width="1" height="${s}" fill="${c}"/>`;
      break;
    case "Dots":
      tile = `<circle cx="0" cy="0" r="1.5" fill="${c}"/><circle cx="${s}" cy="0" r="1.5" fill="${c}"/><circle cx="0" cy="${s}" r="1.5" fill="${c}"/><circle cx="${s}" cy="${s}" r="1.5" fill="${c}"/>`;
      break;
    case null:
      break;
    default:
      assertNever(page.pattern);
  }
  if (tile)
    parts.push(
      `<defs><pattern id="paper" patternUnits="userSpaceOnUse" width="${s}" height="${s}">${tile}</pattern></defs>`,
      `<rect x="${n(area.min.x)}" y="${n(area.min.y)}" width="${n(area.width)}" height="${n(area.height)}" fill="url(#paper)"/>`,
    );

  return parts.join("");
}

/** A standalone SVG document of `area`, sized in CSS pixels (96 per inch). */
export function areaToSvg(
  page: Page,
  assets: Assets,
  area: ContentBounds,
  { paper = true, only }: SvgOptions = {},
): string {
  const sheet = pageRect(page);
  const clip = sheet
    ? `<clipPath id="sheet"><rect x="0" y="0" width="${sheet.width}" height="${sheet.height}"/></clipPath>`
    : "";

  const blocks = page.layers
    .filter((l) => l.visible)
    .flatMap((l) => l.blocks)
    .filter((b) => !only || only.has(b.id))
    .map((b) => blockSvg(b, assets))
    .join("");

  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${n(area.width)}" height="${n(area.height)}" ` +
    `viewBox="${n(area.min.x)} ${n(area.min.y)} ${n(area.width)} ${n(area.height)}">` +
    (paper ? paperSvg(page, area, assets) : "") +
    clip +
    `<g${sheet ? ' clip-path="url(#sheet)"' : ""}>${blocks}</g></svg>`
  );
}

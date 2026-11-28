import type { Block, Page } from "#lib/tauri/bindings.ts";
import type { ContentBounds } from "#lib/util/canvasBounds.ts";
import { assertNever } from "../blocks";
import { pageRect } from "../pageFormats";
import { dotCopies, lineCopies, paperGuides, paperTile } from "../paper";
import { strokeToPath } from "../svg";
import { layoutText, TEXT_FONT_FAMILY, TEXT_LINE_HEIGHT } from "../text";
import type { Assets, InkColor } from "./draw";
import { adaptInk } from "../inkColor";

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

function blockSvg(b: Block, assets: Assets, ink: InkColor): string {
  switch (b.type) {
    case "Stroke": {
      const opacity = b.opacity < 1 ? ` fill-opacity="${b.opacity}"` : "";
      return `<path d="${strokeToPath(b)}" fill="${esc(ink(b.color))}"${opacity}/>`;
    }
    case "Text": {
      const lh = b.font_size * TEXT_LINE_HEIGHT;
      const lines = layoutText(b.text, b.width, b.font_size).lines;
      const tspans = lines
        .map((line, i) => `<tspan x="${n(b.x)}" y="${n(b.y + i * lh + lh / 2)}">${esc(line)}</tspan>`)
        .join("");
      return (
        `<text dominant-baseline="central" xml:space="preserve" fill="${esc(ink(b.color))}" ` +
        `font-size="${b.font_size}" font-family="${esc(TEXT_FONT_FAMILY)}">${tspans}</text>`
      );
    }
    case "Image": {
      const src = assets(b.asset);
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

  const bg = page.background_asset && assets(page.background_asset);
  if (bg && page.width > 0)
    parts.push(`<image href="${bg}" x="0" y="0" width="${page.width}" height="${page.height}" preserveAspectRatio="none"/>`);

  const c = esc(page.pattern_color);
  const t = paperTile(page.pattern, page.pattern_scale);
  if (t) {
    const tile = [
      ...t.rules.map((y) => `<rect y="${n(y)}" width="${n(t.width)}" height="1" fill="${c}"/>`),
      ...t.columns.map((x) => `<rect x="${n(x)}" width="1" height="${n(t.height)}" fill="${c}"/>`),
      ...lineCopies(t).map(
        ([x1, y1, x2, y2]) => `<line x1="${n(x1)}" y1="${n(y1)}" x2="${n(x2)}" y2="${n(y2)}" stroke="${c}" stroke-width="1"/>`,
      ),
      ...dotCopies(t).map(([x, y]) => `<circle cx="${n(x)}" cy="${n(y)}" r="1.5" fill="${c}"/>`),
    ].join("");
    parts.push(
      `<defs><pattern id="paper" patternUnits="userSpaceOnUse" width="${n(t.width)}" height="${n(t.height)}">${tile}</pattern></defs>`,
      `<rect x="${n(area.min.x)}" y="${n(area.min.y)}" width="${n(area.width)}" height="${n(area.height)}" fill="url(#paper)"/>`,
    );
  }
  for (const g of paperGuides(page))
    parts.push(
      `<line x1="${g.x1}" y1="${g.y1}" x2="${g.x2}" y2="${g.y2}" stroke="${esc(g.color ?? page.pattern_color)}" stroke-width="${g.weight}"/>`,
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
    .map((b) => blockSvg(b, assets, (c) => adaptInk(c, page.background_color)))
    .join("");

  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${n(area.width)}" height="${n(area.height)}" ` +
    `viewBox="${n(area.min.x)} ${n(area.min.y)} ${n(area.width)} ${n(area.height)}">` +
    (paper ? paperSvg(page, area, assets) : "") +
    clip +
    `<g${sheet ? ' clip-path="url(#sheet)"' : ""}>${blocks}</g></svg>`
  );
}

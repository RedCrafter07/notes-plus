import type { Layer, Stroke } from "$lib/tauri/bindings";
import { inputToPath } from "$lib/editor/svg";
import {
  collectStrokes,
  getContentBounds,
  padBounds,
  type ContentBounds,
  type Padding,
} from "./canvasBounds";

/**
 * The target output size. Either:
 * - a single number: the longest edge in pixels, with the other edge derived
 *   from the content's aspect ratio (a tight export, no letterboxing); or
 * - an explicit `{ width, height }`: a fixed output canvas the content is
 *   scaled to fit inside and centred (letterboxed when ratios differ).
 */
export type Resolution = number | { width: number; height: number };

export interface FitOptions {
  /** Task 3 boundary added around the content. Defaults to `16`. */
  padding?: Padding;
  /** Background fill color. `null`/omitted leaves it transparent. */
  background?: string | null;
  /** Include strokes on hidden layers. Defaults to `false`. */
  includeHidden?: boolean;
}

/**
 * The content fitted into an output canvas of a given resolution: the output
 * dimensions plus the affine transform (uniform `scale` + `offset`) that maps
 * content-space coordinates onto output pixels.
 */
export interface FittedCanvas {
  /** Output width in pixels. */
  width: number;
  /** Output height in pixels. */
  height: number;
  /** Content units -> output pixels. */
  scale: number;
  /** Horizontal letterbox offset in pixels. */
  offsetX: number;
  /** Vertical letterbox offset in pixels. */
  offsetY: number;
  /** The padded content bounds, in content space. */
  bounds: ContentBounds;
  /** The strokes to render, in draw order. */
  strokes: Stroke[];
  /** Background fill color, or `null` for transparent. */
  background: string | null;
}

/**
 * Task 4 — Takes the canvas content and a target resolution and fits the
 * content into the output canvas. Computes the content bounds (task 2),
 * expands them by the requested boundary (task 3), then derives the output
 * size and the transform needed to place the content inside it.
 *
 * Returns `null` when there is nothing to export. Feed the result to
 * {@link fittedCanvasToSvg} or {@link fittedCanvasToPng}.
 */
export function fitContentToCanvas(
  layers: Layer[],
  resolution: Resolution,
  options: FitOptions = {},
): FittedCanvas | null {
  const raw = getContentBounds(layers, { includeHidden: options.includeHidden });
  if (!raw) return null;

  const bounds = padBounds(raw, options.padding ?? 16);
  const contentW = bounds.width || 1;
  const contentH = bounds.height || 1;

  let width: number;
  let height: number;
  let scale: number;
  let offsetX = 0;
  let offsetY = 0;

  if (typeof resolution === "number") {
    // Longest edge maps to `resolution`; output follows the aspect ratio.
    scale = resolution / Math.max(contentW, contentH);
    width = Math.max(1, Math.round(contentW * scale));
    height = Math.max(1, Math.round(contentH * scale));
  } else {
    // Fixed canvas: scale to fit (meet) and centre.
    width = Math.max(1, Math.round(resolution.width));
    height = Math.max(1, Math.round(resolution.height));
    scale = Math.min(width / contentW, height / contentH);
    offsetX = (width - contentW * scale) / 2;
    offsetY = (height - contentH * scale) / 2;
  }

  return {
    width,
    height,
    scale,
    offsetX,
    offsetY,
    bounds,
    strokes: collectStrokes(layers, options.includeHidden),
    background: options.background ?? null,
  };
}

function escapeAttr(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/**
 * Helper — Renders a {@link FittedCanvas} to a standalone SVG document string.
 * Strokes reuse the same {@link inputToPath} outline as the live editor.
 */
export function fittedCanvasToSvg(fitted: FittedCanvas): string {
  const { bounds, width, height, strokes, background, scale, offsetX, offsetY } =
    fitted;

  const bg = background
    ? `<rect x="0" y="0" width="${width}" height="${height}" fill="${escapeAttr(background)}"/>`
    : "";

  const paths = strokes
    .map((s) => {
      const d = inputToPath(s.points, s.thickness, false);
      return `<path d="${d}" fill="${escapeAttr(s.color)}"/>`;
    })
    .join("");

  // Map content space onto output pixels: undo the bounds origin, scale, then
  // apply the letterbox offset.
  const transform = `translate(${offsetX} ${offsetY}) scale(${scale}) translate(${-bounds.min.x} ${-bounds.min.y})`;

  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" ` +
    `viewBox="0 0 ${width} ${height}">${bg}<g transform="${transform}">${paths}</g></svg>`
  );
}

/**
 * Helper — Renders a {@link FittedCanvas} to a PNG {@link Blob} using an
 * offscreen 2D canvas. Must run in a browser context.
 */
export function fittedCanvasToPng(fitted: FittedCanvas): Promise<Blob> {
  const canvas = document.createElement("canvas");
  canvas.width = fitted.width;
  canvas.height = fitted.height;

  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Could not acquire a 2D canvas context");

  if (fitted.background) {
    ctx.fillStyle = fitted.background;
    ctx.fillRect(0, 0, fitted.width, fitted.height);
  }

  ctx.save();
  ctx.translate(fitted.offsetX, fitted.offsetY);
  ctx.scale(fitted.scale, fitted.scale);
  ctx.translate(-fitted.bounds.min.x, -fitted.bounds.min.y);

  for (const stroke of fitted.strokes) {
    ctx.fillStyle = stroke.color;
    ctx.fill(new Path2D(inputToPath(stroke.points, stroke.thickness, false)));
  }

  ctx.restore();

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("PNG encoding failed"))),
      "image/png",
    );
  });
}

/**
 * Convenience — fit + render to an SVG string in one call. Returns `null`
 * when there is nothing to export.
 */
export function exportContentToSvg(
  layers: Layer[],
  resolution: Resolution,
  options?: FitOptions,
): string | null {
  const fitted = fitContentToCanvas(layers, resolution, options);
  return fitted ? fittedCanvasToSvg(fitted) : null;
}

/**
 * Convenience — fit + render to a PNG {@link Blob} in one call. Returns
 * `null` when there is nothing to export.
 */
export function exportContentToPng(
  layers: Layer[],
  resolution: Resolution,
  options?: FitOptions,
): Promise<Blob> | null {
  const fitted = fitContentToCanvas(layers, resolution, options);
  return fitted ? fittedCanvasToPng(fitted) : null;
}

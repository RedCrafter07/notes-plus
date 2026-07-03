import type { Layer, Stroke } from "$lib/tauri/bindings";

export interface Point2D {
  x: number;
  y: number;
}

/**
 * An axis-aligned bounding box described by four coordinates, i.e. two
 * `(x, y)` pairs: `min` is the top-left corner, `max` is the bottom-right.
 */
export interface ContentBounds {
  min: Point2D;
  max: Point2D;
  width: number;
  height: number;
}

/** A uniform margin, or a per-side one. Missing sides default to `0`. */
export type Padding =
  | number
  | { top?: number; right?: number; bottom?: number; left?: number };

/**
 * Collects every drawable stroke across the given layers, in draw order.
 * Hidden layers are skipped unless `includeHidden` is set, and empty
 * strokes are dropped.
 */
export function collectStrokes(
  layers: Layer[],
  includeHidden = false,
): Stroke[] {
  return layers
    .filter((l) => includeHidden || l.visible)
    .flatMap((l) => l.blocks)
    .map((b) => b.Stroke)
    .filter((s): s is Stroke => s != null && s.points.length > 0);
}

/**
 * Task 2 — Finds the coordinate boundaries of the content: the smallest box
 * that encloses everything actually drawn. Stroke thickness is taken into
 * account so the box covers the inked pixels, not just the centre line.
 *
 * Coordinates are in the note's own (zoom/pan-independent) content space.
 * Returns `null` when there is nothing drawn.
 */
export function getContentBounds(
  layers: Layer[],
  options: { includeHidden?: boolean } = {},
): ContentBounds | null {
  const strokes = collectStrokes(layers, options.includeHidden);

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (const stroke of strokes) {
    const half = stroke.thickness / 2;
    for (const p of stroke.points) {
      if (p.x - half < minX) minX = p.x - half;
      if (p.y - half < minY) minY = p.y - half;
      if (p.x + half > maxX) maxX = p.x + half;
      if (p.y + half > maxY) maxY = p.y + half;
    }
  }

  if (!Number.isFinite(minX)) return null;

  return {
    min: { x: minX, y: minY },
    max: { x: maxX, y: maxY },
    width: maxX - minX,
    height: maxY - minY,
  };
}

/**
 * Task 3 — Calculates a boundary around the given bounds by expanding it
 * with a margin. Accepts a single number for a uniform margin or an object
 * for per-side control. Returns a new `ContentBounds`.
 */
export function padBounds(bounds: ContentBounds, padding: Padding): ContentBounds {
  const p =
    typeof padding === "number"
      ? { top: padding, right: padding, bottom: padding, left: padding }
      : {
          top: padding.top ?? 0,
          right: padding.right ?? 0,
          bottom: padding.bottom ?? 0,
          left: padding.left ?? 0,
        };

  const min = { x: bounds.min.x - p.left, y: bounds.min.y - p.top };
  const max = { x: bounds.max.x + p.right, y: bounds.max.y + p.bottom };

  return {
    min,
    max,
    width: max.x - min.x,
    height: max.y - min.y,
  };
}

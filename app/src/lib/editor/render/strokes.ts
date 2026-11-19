import type { StrokeBlock } from "../blocks";
import { inputToPath } from "../svg";

/*
 * Outlining a stroke with perfect-freehand is the expensive part of drawing,
 * so the resulting Path2D is cached by stroke id. Strokes are never mutated in
 * place (an edit mints a new id), so an id's path never goes stale.
 */

const paths = new Map<string, Path2D>();

export function strokePath(s: StrokeBlock): Path2D {
  let p = paths.get(s.id);
  if (!p) {
    p = new Path2D(inputToPath(s.points, s.thickness, false));
    paths.set(s.id, p);
  }
  return p;
}

/** Drops cached paths whose id is not in `live`. */
export function prunePaths(live: Set<string>) {
  for (const id of paths.keys()) if (!live.has(id)) paths.delete(id);
}

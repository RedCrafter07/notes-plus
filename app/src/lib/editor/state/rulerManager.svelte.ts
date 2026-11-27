import { contentManager } from "#lib/state/contentManager.svelte.ts";
import type { Point2D } from "#lib/util/canvasBounds.ts";
import type { Similarity } from "../blocks";
import {
  EDGE_MARGIN,
  hitRuler,
  moveRuler,
  normalize,
  RULER_LENGTH,
  RULER_WIDTH,
  rulerEdge,
  type EdgeLine,
  type RulerPose,
} from "../ruler";

/** The ruler's visibility and position (view state, see `ruler.ts`). */
class RulerManager {
  visible = $state(false);
  pose = $state<RulerPose>({ center: { x: 0, y: 0 }, angle: 0 });
  /** Pose when the current move started; gestures are measured from it. */
  #start: RulerPose | undefined;

  /** Half the ruler's width in page units, for the current zoom. */
  get halfWidth() {
    return RULER_WIDTH / 2 / contentManager.zoom;
  }

  get halfLength() {
    return RULER_LENGTH / 2 / contentManager.zoom;
  }

  /** Shows the ruler level across `center` (the middle of the view), or hides it. */
  toggle(center: Point2D) {
    if (!this.visible) this.pose = { center, angle: 0 };
    this.visible = !this.visible;
  }

  hit(p: Point2D): boolean {
    return this.visible && hitRuler(this.pose, p, this.halfWidth, this.halfLength);
  }

  /** The edge a stroke starting at `p` follows, if any. */
  edgeAt(p: Point2D, thickness: number): EdgeLine | undefined {
    if (!this.visible) return;
    return rulerEdge(this.pose, p, {
      halfWidth: this.halfWidth,
      halfLength: this.halfLength,
      margin: EDGE_MARGIN / contentManager.zoom,
      thickness,
    });
  }

  /** Starts (or restarts, when fingers are added or lifted) measuring a move. */
  begin() {
    this.#start = $state.snapshot(this.pose);
  }

  move(g: Similarity | undefined) {
    if (this.#start && g) this.pose = moveRuler(this.#start, g);
  }

  end() {
    this.#start = undefined;
  }

  /** Turns the ruler about `pivot` (mouse wheel), without snapping. */
  rotateBy(delta: number, pivot: Point2D) {
    const { center, angle } = this.pose;
    const c = Math.cos(delta);
    const s = Math.sin(delta);
    const dx = center.x - pivot.x;
    const dy = center.y - pivot.y;
    this.pose = {
      center: { x: pivot.x + dx * c - dy * s, y: pivot.y + dx * s + dy * c },
      angle: normalize(angle + delta),
    };
  }
}

export const rulerManager = new RulerManager();

import type { Page, Point } from "#lib/tauri/bindings.ts";

/*
 * Messages from the editor window to the presenter-mode audience window,
 * sent with Tauri's `emitTo("audience", PRESENT_EVENT, msg)`. The audience
 * asks for a full resend by emitting READY_EVENT to the editor when it loads.
 */

export const PRESENT_EVENT = "present";
export const READY_EVENT = "present-ready";
export const AUDIENCE = "audience";

export type ViewMode = "fit" | "follow";

export interface LaserStroke {
  id: string;
  points: Point[];
  /** 0..1, fades out after the pen lifts. */
  opacity: number;
}

export type PresentMessage =
  /**
   * The page being shown. Sent whenever it changes (per committed edit).
   * `assets` is the note's attachment session, for loading its images.
   */
  | { kind: "page"; page: Page; assets: string }
  /** The editor's visible area, for "follow" mode. */
  | { kind: "view"; zoom: number; panX: number; panY: number; width: number; height: number }
  /** The stroke being drawn right now (empty points when none). */
  | {
      kind: "ink";
      points: Point[];
      color: string;
      thickness: number;
      opacity: number;
      thinning: number;
    }
  | { kind: "laser"; strokes: LaserStroke[] }
  | { kind: "state"; mode: ViewMode; blank: boolean };

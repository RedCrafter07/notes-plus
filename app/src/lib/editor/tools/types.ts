import type { Point } from "#lib/tauri/bindings.ts";

export type ToolHandler = (p: Point, e: PointerEvent) => void;

export interface ToolHandlers {
  down?: ToolHandler;
  move?: ToolHandler;
  up?: ToolHandler;
}

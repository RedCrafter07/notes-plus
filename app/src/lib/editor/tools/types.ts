import type { Point } from "$lib/tauri/bindings";

export type ToolHandler = (p: Point, e: PointerEvent) => void;

export interface ToolHandlers {
  down?: ToolHandler;
  move?: ToolHandler;
  up?: ToolHandler;
}

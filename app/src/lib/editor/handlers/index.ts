import type { Point } from "$lib/tauri/bindings";
import type { Tool } from "../state/canvasManager.svelte";
import { pen } from "./tools/pen";
import { eraser } from "./tools/eraser";
import { lasso } from "./tools/lasso";

export type ToolHandler = (p: Point, e: PointerEvent) => void;

export interface ToolHandlers {
  down?: ToolHandler;
  move?: ToolHandler;
  up?: ToolHandler;
}

export const toolHandlers: Record<Tool, ToolHandlers> = { pen, eraser, lasso };

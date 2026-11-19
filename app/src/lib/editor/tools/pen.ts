import { canvasManager } from "$lib/editor/state/canvasManager.svelte";
import type { ToolHandler, ToolHandlers } from "./types";

const down: ToolHandler = (p, e) => {
  if (e.button !== 0) return;
  canvasManager.drawing = true;
  canvasManager.addPoint(p);
};
const move: ToolHandler = (p) => {
  if (canvasManager.drawing) canvasManager.addPoint(p);
};
const up: ToolHandler = () => {
  canvasManager.drawing = false;
  canvasManager.finishStroke();
};

/** Pen and highlighter share the gesture; the tool's opacity tells them apart. */
export const pen: ToolHandlers = { down, move, up };
export const highlighter: ToolHandlers = { down, move, up };

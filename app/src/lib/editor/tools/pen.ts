import { canvasManager } from "#lib/editor/state/canvasManager.svelte.ts";
import type { ToolHandler, ToolHandlers } from "./types";

const down: ToolHandler = (p, e) => {
  // A right click does not draw; but a pen touching down with its barrel
  // button held also reports button 2, and then a held tool should draw.
  if (e.button !== 0 && !canvasManager.heldTool) return;
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

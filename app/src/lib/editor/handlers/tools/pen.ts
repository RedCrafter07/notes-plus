import { canvasManager } from "$lib/editor/state/canvasManager.svelte";
import type { ToolHandler, ToolHandlers } from "..";

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

export const pen: ToolHandlers = { down, move, up };

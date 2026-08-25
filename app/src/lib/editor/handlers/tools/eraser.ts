import { canvasManager } from "$lib/editor/state/canvasManager.svelte";
import type { ToolHandler, ToolHandlers } from "..";

const down: ToolHandler = (p) => {
  canvasManager.eraser(p);
};
const move: ToolHandler = (p) => {
  canvasManager.eraser(p);
};

export const eraser: ToolHandlers = { down, move };

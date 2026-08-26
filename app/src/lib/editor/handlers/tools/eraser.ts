import { canvasManager } from "$lib/editor/state/canvasManager.svelte";
import type { Point } from "$lib/tauri/bindings";
import type { ToolHandler, ToolHandlers } from "..";

let last: Point | undefined;

const down: ToolHandler = (p) => {
  last = p;
  canvasManager.eraser(p);
};
const move: ToolHandler = (p) => {
  canvasManager.eraseAlong(last ?? p, p);
  last = p;
};
const up: ToolHandler = () => {
  last = undefined;
  canvasManager.cleanCache();
};

export const eraser: ToolHandlers = { down, move, up };

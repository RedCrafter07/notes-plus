import { settingsStore } from "$lib/state/settingsStore.svelte";
import { canvasManager, type Tool } from "./state/canvasManager.svelte";
import { lassoManager } from "./state/lassoManager.svelte";

const BUTTON_PRIMARY = 1;
const BUTTON_SECONDARY = 2;
const BUTTON_AUXILIARY = 4;
const BUTTON_ERASER = 32;

const LASSO_BUTTONS = BUTTON_SECONDARY | BUTTON_AUXILIARY;

export function toolFromButtons(buttons: number): Tool | undefined {
  if (buttons === 0) return undefined; // nothing held

  if (
    canvasManager.lockTool ||
    lassoManager.selection ||
    settingsStore.store.disable_tool_switch
  ) {
    return canvasManager.tool;
  }

  if (buttons & BUTTON_ERASER) return "eraser";
  else if (buttons & LASSO_BUTTONS) return "lasso";
  else if (buttons & BUTTON_PRIMARY) return "pen";
}

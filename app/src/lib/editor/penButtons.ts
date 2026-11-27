import type { Tool } from "./tools/registry";

/*
 * What the physical buttons of a stylus do. The pen *tip* never changes the
 * tool: it always uses whatever is selected in the toolbar (pen, marker,
 * text, ...). Mapping the tip to "pen" made choosing the highlighter
 * pointless, since the next stroke switched straight back.
 *
 * - Eraser end: erases for as long as it touches ("hold"); the selected
 *   tool is untouched, so lifting the pen returns to it.
 * - Barrel button, by the `barrel_button` setting:
 *   - "lasso" (default): switches to the lasso ("sticky", because a
 *     selection is then dragged with the tip). The previous tool comes back
 *     once nothing is selected any more.
 *   - "eraser" / "highlighter": that tool only while the button is held
 *     ("hold"), like the eraser end; lifting the pen returns to the tool.
 */

export type BarrelAction = "lasso" | "eraser" | "highlighter";

export const BUTTON_PRIMARY = 1;
export const BUTTON_SECONDARY = 2; // barrel button
export const BUTTON_AUXILIARY = 4; // second barrel button on some pens
export const BUTTON_ERASER = 32; // eraser end

export type PenOverride = { tool: Tool; mode: "hold" | "sticky" };

export function penOverride(
  buttons: number,
  current: Tool,
  { disabled = false, barrel = "lasso" }: { disabled?: boolean; barrel?: BarrelAction } = {},
): PenOverride | undefined {
  if (disabled) return undefined;
  if (buttons & BUTTON_ERASER) return { tool: "eraser", mode: "hold" };
  if (buttons & (BUTTON_SECONDARY | BUTTON_AUXILIARY) && current !== barrel)
    return { tool: barrel, mode: barrel === "lasso" ? "sticky" : "hold" };
  return undefined;
}

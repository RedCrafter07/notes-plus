import type { PenPreset } from "#lib/tauri/bindings.ts";

/*
 * Pen presets: saved pens (tool, colour, width) in Settings, so they are
 * the same in every notebook and window, like the colour swatches. A tap
 * switches to one; these helpers keep the list free of duplicates.
 */

/** Enough for a pencil case; the toolbar has to stay usable. */
export const MAX_PRESETS = 10;

/** Whether the pen in use is exactly this preset (shown as active). */
export function isCurrentPreset(p: PenPreset, current: PenPreset): boolean {
  return p.tool === current.tool && p.size === current.size && p.color.toLowerCase() === current.color.toLowerCase();
}

/** The list with `p` added at the end, unless it is already there or full. */
export function withPreset(list: PenPreset[], p: PenPreset): PenPreset[] {
  if (list.length >= MAX_PRESETS || list.some((q) => isCurrentPreset(q, p))) return list;
  return [...list, p];
}

export function withoutPreset(list: PenPreset[], index: number): PenPreset[] {
  return list.filter((_, i) => i !== index);
}

/** Dot diameter in px for a preset button: grows with the width, within the button. */
export function presetDot(size: number): number {
  return Math.min(22, Math.max(5, 4 + size * 0.7));
}

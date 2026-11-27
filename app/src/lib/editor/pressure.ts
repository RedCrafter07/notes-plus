import type { PenPressure, Point } from "#lib/tauri/bindings.ts";

/**
 * perfect-freehand's `thinning` for each pressure setting: how far the
 * width moves from the nominal one between no and full pressure. At a
 * pressure of 0.5 (and with a mouse, which always reports 0.5) the stroke
 * has exactly the chosen width.
 */
export const PRESSURE_THINNING: Record<PenPressure, number> = {
  off: 0,
  light: 0.35,
  strong: 0.65,
};

/**
 * A short wave drawn with light, then firm, then light pressure, to show a
 * setting's effect before writing with it.
 */
export function pressurePreview(width: number, height: number): Point[] {
  const n = 60;
  return Array.from({ length: n }, (_, i) => {
    const t = i / (n - 1);
    return {
      x: 8 + t * (width - 16),
      y: height / 2 + Math.sin(t * Math.PI * 3) * (height / 4),
      pressure: 0.1 + 0.85 * Math.sin(t * Math.PI),
    };
  });
}

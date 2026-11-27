import { describe, expect, it } from "vitest";
import type { PenPreset } from "#lib/tauri/bindings.ts";
import { isCurrentPreset, MAX_PRESETS, presetDot, withoutPreset, withPreset } from "./presets";

const red: PenPreset = { tool: "pen", color: "#F22E2E", size: 2 };

describe("pen presets", () => {
  it("matches the current pen regardless of colour case", () => {
    expect(isCurrentPreset(red, { tool: "pen", color: "#f22e2e", size: 2 })).toBe(true);
    expect(isCurrentPreset(red, { tool: "highlighter", color: "#f22e2e", size: 2 })).toBe(false);
    expect(isCurrentPreset(red, { tool: "pen", color: "#f22e2e", size: 2.5 })).toBe(false);
  });

  it("adds at the end, but no duplicates and not past the limit", () => {
    expect(withPreset([], red)).toEqual([red]);
    const list = [red];
    expect(withPreset(list, { ...red, color: "#f22e2e" })).toBe(list);
    const full = Array.from({ length: MAX_PRESETS }, (_, i) => ({ ...red, size: i + 1 }));
    expect(withPreset(full, { ...red, size: 99 })).toBe(full);
  });

  it("removes by position", () => {
    const blue: PenPreset = { tool: "pen", color: "#0000ff", size: 4 };
    expect(withoutPreset([red, blue], 0)).toEqual([blue]);
  });

  it("draws a dot that grows with the width but fits the button", () => {
    expect(presetDot(0.5)).toBe(5);
    expect(presetDot(8)).toBeGreaterThan(presetDot(2));
    expect(presetDot(80)).toBe(22);
  });
});

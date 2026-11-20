import { describe, expect, test } from "vitest";
import { BUTTON_ERASER, BUTTON_PRIMARY, BUTTON_SECONDARY, penOverride } from "./penButtons";

describe("penOverride", () => {
  test("the tip keeps the selected tool", () => {
    expect(penOverride(BUTTON_PRIMARY, "highlighter")).toBeUndefined();
    expect(penOverride(BUTTON_PRIMARY, "text")).toBeUndefined();
  });

  test("the eraser end erases only while held", () => {
    expect(penOverride(BUTTON_ERASER, "highlighter")).toEqual({ tool: "eraser", mode: "hold" });
  });

  test("the barrel button switches to the lasso", () => {
    expect(penOverride(BUTTON_PRIMARY | BUTTON_SECONDARY, "pen")).toEqual({ tool: "lasso", mode: "sticky" });
    expect(penOverride(BUTTON_SECONDARY, "lasso")).toBeUndefined();
  });

  test("the setting turns all of it off", () => {
    expect(penOverride(BUTTON_ERASER, "pen", { disabled: true })).toBeUndefined();
  });
});

import { beforeEach, describe, expect, it } from "vitest";
import { loadWorkspace as load, saveWorkspace, type ToolInfo } from "./workspace";

const ranges: Record<string, { min: number; max: number }> = {
  pen: { min: 1, max: 40 },
  highlighter: { min: 6, max: 80 },
  eraser: { min: 4, max: 120 },
};
const tools: ToolInfo = {
  ids: ["pen", "highlighter", "eraser", "lasso", "text", "laser"],
  size: (t) => ranges[t],
};
const loadWorkspace = () => load(tools);

const store = new Map<string, string>();
globalThis.localStorage = {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => void store.set(k, v),
} as Storage;

describe("workspace", () => {
  beforeEach(() => store.clear());

  it("round-trips a valid workspace", () => {
    const w = {
      tool: "highlighter" as const,
      colors: { pen: "#ff0000" },
      sizes: { pen: 6, eraser: 40 },
      eraserMode: "stroke" as const,
      zoomLock: false,
      scaleWidths: false,
      lassoMode: "contain" as const,
      rotationLock: true,
    };
    saveWorkspace(w);
    expect(loadWorkspace()).toEqual(w);
  });

  it("drops what is invalid or out of range, keeps the rest", () => {
    store.set(
      "rednotes.workspace.v1",
      JSON.stringify({
        tool: "laser",
        colors: { pen: "red; }", nope: "#000" , highlighter: "#ffe600" },
        sizes: { pen: 9999, eraser: 30 },
        eraserMode: "sideways",
        zoomLock: "yes",
        scaleWidths: 1,
        lassoMode: "around",
        rotationLock: "no",
      }),
    );
    expect(loadWorkspace()).toEqual({
      colors: { highlighter: "#ffe600" },
      sizes: { eraser: 30 },
    });
  });

  it("survives garbage", () => {
    store.set("rednotes.workspace.v1", "{not json");
    expect(loadWorkspace()).toEqual({});
  });
});

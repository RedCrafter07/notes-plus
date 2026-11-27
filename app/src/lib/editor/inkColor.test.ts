import { describe, expect, it } from "vitest";
import { adaptInk, contrast, displayPaper, isDarkPaper, luminance, parseHex } from "./inkColor";

const DARK = "#1e1e2e";
const rgb = (c: string) => parseHex(c)!;

describe("adaptInk", () => {
  it("leaves every ink alone on light paper", () => {
    for (const ink of ["#000000", "#55ea41", "#ffff00"]) expect(adaptInk(ink, "#ffffff")).toBe(ink);
  });

  it("turns black ink white on dark paper", () => {
    expect(adaptInk("#000000", DARK)).toBe("#ffffff");
  });

  it("lightens dark colours but keeps their hue", () => {
    const navy = adaptInk("#1e3a8a", DARK);
    expect(contrast(rgb(navy), rgb(DARK))).toBeGreaterThanOrEqual(3);
    const n = rgb(navy);
    expect(n.b).toBeGreaterThan(n.r); // still blue
  });

  it("keeps colours that already stand out", () => {
    expect(adaptInk("#f22e2e", DARK)).toBe("#f22e2e");
    expect(adaptInk("#ffff00", DARK)).toBe("#ffff00");
  });

  it("keeps an alpha suffix and ignores what it cannot parse", () => {
    expect(adaptInk("#00000080", DARK)).toBe("#ffffff80");
    expect(adaptInk("black", DARK)).toBe("black");
    expect(adaptInk("#000", "transparent")).toBe("#000");
  });
});

describe("displayPaper", () => {
  it("shows white paper dark, with the ruling lighter than the paper", () => {
    const p = displayPaper("#ffffff", "#d4d4d8", true);
    expect(p.inverted).toBe(true);
    expect(isDarkPaper(p.background)).toBe(true);
    expect(luminance(rgb(p.pattern))).toBeGreaterThan(luminance(rgb(p.background)));
    // ...so black ink drawn on it turns light.
    expect(adaptInk("#000000", p.background)).toBe("#ffffff");
  });

  it("changes nothing when off, or when the paper is already dark", () => {
    expect(displayPaper("#ffffff", "#d4d4d8", false)).toEqual({
      background: "#ffffff",
      pattern: "#d4d4d8",
      inverted: false,
    });
    expect(displayPaper(DARK, "#45475a", true).inverted).toBe(false);
  });
});

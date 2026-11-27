import { describe, expect, it } from "vitest";
import { detectScan, isOversized, PT_TO_UNITS, sizeFactor } from "./pdfScale";

describe("detectScan", () => {
  it("recognises A4 scanned at 300 dpi, either way round", () => {
    expect(detectScan(2480, 3508)).toMatchObject({ paper: "A4", dpi: 300 });
    const landscape = detectScan(3508, 2480)!;
    expect(landscape.paper).toBe("A4");
    expect(3508 * landscape.factor).toBeCloseTo(841.9, 0);
  });

  it("recognises Letter at 200 dpi and A5 at 600 dpi", () => {
    expect(detectScan(1700, 2200)).toMatchObject({ paper: "Letter", dpi: 200 });
    expect(detectScan(3496, 4960)).toMatchObject({ paper: "A5", dpi: 600 });
  });

  it("allows a slightly cropped scan", () => {
    expect(detectScan(2460, 3480)?.paper).toBe("A4");
  });

  it("leaves real paper sizes and odd sizes alone", () => {
    expect(detectScan(595.28, 841.89)).toBeUndefined(); // A4
    expect(detectScan(612, 792)).toBeUndefined(); // Letter
    expect(detectScan(960, 540)).toBeUndefined(); // 16:9 slides
    expect(detectScan(0, 0)).toBeUndefined();
  });
});

describe("isOversized", () => {
  it("flags scans and huge pages, not normal ones", () => {
    expect(isOversized(2480, 3508)).toBe(true);
    expect(isOversized(2000, 1500)).toBe(true);
    expect(isOversized(595, 842)).toBe(false);
    expect(isOversized(842, 1191)).toBe(false); // A3
  });
});

describe("sizeFactor", () => {
  it("brings a scan back to its paper size", () => {
    const k = sizeFactor({ kind: "real" }, 2480, 3508);
    expect(2480 * k * PT_TO_UNITS).toBeCloseTo(793.7, 0); // A4 width in units
    expect(sizeFactor({ kind: "real" }, 595, 842)).toBe(1);
  });

  it("matches a width, keeps, or uses a percentage", () => {
    expect(1000 * PT_TO_UNITS * sizeFactor({ kind: "match", width: 794 }, 1000, 1400)).toBeCloseTo(794);
    expect(sizeFactor({ kind: "keep" }, 2480, 3508)).toBe(1);
    expect(sizeFactor({ kind: "custom", percent: 50 }, 2480, 3508)).toBe(0.5);
  });
});

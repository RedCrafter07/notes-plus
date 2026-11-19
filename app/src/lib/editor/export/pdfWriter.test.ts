import { describe, expect, test } from "vitest";
import { buildPdf } from "./pdfWriter";

const decode = (b: Uint8Array) => new TextDecoder("latin1").decode(b);

describe("buildPdf", () => {
  const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xd9]);
  const pdf = buildPdf([
    { jpeg, pixelWidth: 2, pixelHeight: 3, width: 595.5, height: 842 },
    { jpeg, pixelWidth: 2, pixelHeight: 3, width: 842, height: 595.5 },
  ]);
  const text = decode(pdf);

  test("has a header, trailer and both pages", () => {
    expect(text.startsWith("%PDF-1.4")).toBe(true);
    expect(text.trimEnd().endsWith("%%EOF")).toBe(true);
    expect(text).toContain("/Count 2");
    expect(text).toContain("/MediaBox [0 0 595.5 842]");
  });

  test("xref offsets point at their objects", () => {
    const xrefAt = Number(/startxref\n(\d+)/.exec(text)![1]);
    const table = text.slice(xrefAt).split("\n");
    const count = Number(table[1].split(" ")[1]);
    for (let id = 1; id < count; id++) {
      const offset = Number(table[2 + id].slice(0, 10));
      expect(text.slice(offset).startsWith(`${id} 0 obj`)).toBe(true);
    }
  });

  test("stream lengths match their content", () => {
    for (const m of text.matchAll(/\/Length (\d+) >>\nstream\n/g)) {
      const start = m.index! + m[0].length;
      const end = text.indexOf("\nendstream", start);
      expect(end - start).toBe(Number(m[1]));
    }
  });
});

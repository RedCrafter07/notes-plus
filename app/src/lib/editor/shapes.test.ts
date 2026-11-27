import { describe, expect, it } from "vitest";
import type { Point2D } from "#lib/util/canvasBounds.ts";
import { recognizeShape, shapePoints, snapLineEnd } from "./shapes";

/** Walks the corners with `per` points per edge and a small hand-like wobble. */
function drawn(corners: Point2D[], per = 30, wobble = 1.5): Point2D[] {
  const out: Point2D[] = [];
  let k = 0;
  for (let i = 0; i < corners.length - 1; i++) {
    const a = corners[i];
    const b = corners[i + 1];
    const len = Math.hypot(b.x - a.x, b.y - a.y);
    const nx = -(b.y - a.y) / len;
    const ny = (b.x - a.x) / len;
    for (let j = 0; j < per; j++) {
      const t = j / per;
      const w = Math.sin(k++ * 0.7) * wobble;
      out.push({ x: a.x + (b.x - a.x) * t + nx * w, y: a.y + (b.y - a.y) * t + ny * w });
    }
  }
  out.push(corners[corners.length - 1]);
  return out;
}

function ellipse(cx: number, cy: number, rx: number, ry: number, wobble = 1.5, n = 120): Point2D[] {
  return Array.from({ length: n + 1 }, (_, i) => {
    const t = (i / n) * Math.PI * 2;
    const w = 1 + (Math.sin(i * 0.9) * wobble) / Math.max(rx, ry);
    return { x: cx + Math.cos(t) * rx * w, y: cy + Math.sin(t) * ry * w };
  });
}

describe("recognizeShape", () => {
  it("straightens a wobbly line and snaps it level", () => {
    const s = recognizeShape(drawn([{ x: 0, y: 0 }, { x: 200, y: 6 }]));
    expect(s?.kind).toBe("line");
    if (s?.kind !== "line") return;
    expect(s.from).toEqual({ x: 0, y: 0 });
    expect(s.to.y).toBeCloseTo(0);
    expect(s.to.x).toBeCloseTo(Math.hypot(200, 6));
  });

  it("keeps a slanted line's angle", () => {
    const s = recognizeShape(drawn([{ x: 0, y: 0 }, { x: 200, y: 60 }]));
    expect(s).toMatchObject({ kind: "line", to: { x: 200, y: 60 } });
  });

  it("turns a rough rectangle into an upright one", () => {
    const s = recognizeShape(
      drawn([{ x: 2, y: 0 }, { x: 200, y: 4 }, { x: 198, y: 120 }, { x: 0, y: 118 }, { x: 3, y: 2 }]),
    );
    expect(s?.kind).toBe("polygon");
    if (s?.kind !== "polygon") return;
    expect(s.corners).toHaveLength(4);
    // Axis-aligned: opposite sides share a coordinate.
    const xs = new Set(s.corners.map((c) => Math.round(c.x)));
    const ys = new Set(s.corners.map((c) => Math.round(c.y)));
    expect(xs.size).toBe(2);
    expect(ys.size).toBe(2);
  });

  it("finds a triangle, wherever the stroke starts", () => {
    const tri = [{ x: 100, y: 0 }, { x: 200, y: 170 }, { x: 0, y: 170 }];
    // Start half-way along an edge, as people often do.
    const start = { x: 150, y: 85 };
    const s = recognizeShape(drawn([start, tri[1], tri[2], tri[0], start]));
    expect(s?.kind).toBe("polygon");
    if (s?.kind === "polygon") expect(s.corners).toHaveLength(3);
  });

  it("recognises a circle and an ellipse", () => {
    const c = recognizeShape(ellipse(100, 100, 80, 78));
    expect(c).toMatchObject({ kind: "ellipse", angle: 0 });
    if (c?.kind === "ellipse") expect(c.rx).toBe(c.ry);

    const e = recognizeShape(ellipse(0, 0, 150, 60));
    expect(e?.kind).toBe("ellipse");
    if (e?.kind !== "ellipse") return;
    expect(Math.max(e.rx, e.ry)).toBeGreaterThan(140);
    expect(Math.min(e.rx, e.ry)).toBeLessThan(70);
  });

  it("leaves open curves and scribbles alone", () => {
    const arc = Array.from({ length: 50 }, (_, i) => ({ x: Math.cos(i / 20) * 100, y: Math.sin(i / 20) * 100 }));
    expect(recognizeShape(arc)).toBeUndefined();
    const zigzag = Array.from({ length: 40 }, (_, i) => ({ x: i * 5, y: (i % 2) * 40 }));
    expect(recognizeShape(zigzag)).toBeUndefined();
    expect(recognizeShape([{ x: 1, y: 1 }])).toBeUndefined();
  });
});

describe("snapLineEnd", () => {
  it("snaps to 45° only when close", () => {
    const d = snapLineEnd({ x: 0, y: 0 }, { x: 100, y: 97 });
    expect(d.x).toBeCloseTo(d.y);
    expect(snapLineEnd({ x: 0, y: 0 }, { x: 100, y: 60 })).toEqual({ x: 100, y: 60 });
  });
});

describe("shapePoints", () => {
  it("closes polygons and ellipses", () => {
    const p = shapePoints({ kind: "polygon", corners: [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 0, y: 1 }] });
    expect(p).toHaveLength(31);
    expect(p[p.length - 1]).toEqual(p[0]);
    const e = shapePoints({ kind: "ellipse", center: { x: 0, y: 0 }, rx: 2, ry: 1, angle: 0 });
    expect(e[0].x).toBeCloseTo(e[e.length - 1].x);
    expect(e[0].y).toBeCloseTo(e[e.length - 1].y);
  });
});

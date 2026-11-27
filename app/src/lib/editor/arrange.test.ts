import { describe, expect, it } from "vitest";
import { arrange } from "./arrange";

const blocks = ["a", "b", "c", "d", "e"].map((id) => ({ id }));
const ids = (bs: { id: string }[]) => bs.map((b) => b.id).join("");
const sel = (s: string) => new Set(s.split(""));

describe("arrange", () => {
  it("brings to front and sends to back, keeping the selection's own order", () => {
    expect(ids(arrange(blocks, sel("bd"), "front"))).toBe("acebd");
    expect(ids(arrange(blocks, sel("bd"), "back"))).toBe("bdace");
  });

  it("moves one step forward or backward past an unselected neighbour", () => {
    expect(ids(arrange(blocks, sel("b"), "forward"))).toBe("acbde");
    expect(ids(arrange(blocks, sel("d"), "backward"))).toBe("abdce");
  });

  it("moves a run of selected blocks one step as a whole", () => {
    expect(ids(arrange(blocks, sel("bc"), "forward"))).toBe("adbce");
    expect(ids(arrange(blocks, sel("cd"), "backward"))).toBe("acdbe");
  });

  it("leaves blocks that are already on top or at the bottom where they are", () => {
    expect(ids(arrange(blocks, sel("e"), "forward"))).toBe("abcde");
    expect(ids(arrange(blocks, sel("a"), "backward"))).toBe("abcde");
  });

  it("returns a new array", () => {
    expect(arrange(blocks, sel("c"), "front")).not.toBe(blocks);
  });
});

import { describe, expect, test } from "vitest";
import { layoutText } from "./text";

// Without a DOM, layoutText estimates every character as 0.55 * fontSize.
// With fontSize 10 that is 5.5 units per character.
describe("layoutText", () => {
  test("keeps short text on one line", () => {
    expect(layoutText("hello", 100, 10).lines).toEqual(["hello"]);
  });

  test("wraps on word boundaries without leading spaces", () => {
    // "aaaa bbbb" = 9 chars = 49.5 > 40
    expect(layoutText("aaaa bbbb", 40, 10).lines).toEqual(["aaaa", "bbbb"]);
  });

  test("keeps explicit newlines and empty lines", () => {
    expect(layoutText("a\n\nb", 100, 10).lines).toEqual(["a", "", "b"]);
  });

  test("breaks words wider than the box", () => {
    // 4 chars = 22 units fit in 25; the fifth does not.
    expect(layoutText("abcdefgh", 25, 10).lines).toEqual(["abcd", "efgh"]);
  });

  test("breaks a long word that follows other text", () => {
    expect(layoutText("x abcdefgh", 25, 10).lines).toEqual([
      "x",
      "abcd",
      "efgh",
    ]);
  });

  test("height follows the line count", () => {
    expect(layoutText("a\nb", 100, 10).height).toBeCloseTo(27);
  });
});

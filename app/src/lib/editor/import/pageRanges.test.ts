import { describe, expect, test } from "vitest";
import { formatPageRanges, parsePageRanges } from "./pageRanges";

describe("page ranges", () => {
  test("parses single pages and ranges, sorted and unique", () => {
    expect(parsePageRanges("1-3, 7", 10)).toEqual([1, 2, 3, 7]);
    expect(parsePageRanges("7 2 2", 10)).toEqual([2, 7]);
  });

  test("open-ended ranges", () => {
    expect(parsePageRanges("8-", 10)).toEqual([8, 9, 10]);
    expect(parsePageRanges("-2", 10)).toEqual([1, 2]);
  });

  test("rejects what it can't understand or what is out of range", () => {
    expect(parsePageRanges("", 10)).toBeNull();
    expect(parsePageRanges("abc", 10)).toBeNull();
    expect(parsePageRanges("0", 10)).toBeNull();
    expect(parsePageRanges("11", 10)).toBeNull();
    expect(parsePageRanges("5-3", 10)).toBeNull();
  });

  test("formats back into ranges", () => {
    expect(formatPageRanges([1, 2, 3, 7, 9, 10])).toBe("1-3, 7, 9-10");
    expect(formatPageRanges([])).toBe("");
  });
});

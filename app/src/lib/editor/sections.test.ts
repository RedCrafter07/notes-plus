import { describe, expect, test } from "vitest";
import type { Page, PageSection } from "#lib/tauri/bindings.ts";
import {
  groupIntoSection,
  groups,
  moveGroup,
  movePages,
  nextSectionName,
  removeSection,
  renameSection,
  startSection,
  stepPage,
} from "./sections";

const A: PageSection = { id: "a", name: "A" };
const B: PageSection = { id: "b", name: "B" };

function page(id: string, section: PageSection | null = null): Page {
  return {
    id,
    section,
    name: id,
    width: 794,
    height: 1123,
    pattern: null,
    pattern_scale: 24,
    pattern_color: "#dddddd",
    background_color: "#ffffff",
    background_asset: null,
    regions: [],
    layers: [],
  };
}

const ids = (pages: Page[]) => pages.map((p) => p.id).join(" ");
/** Page ids with their section names: "1 2 | A: 3 4". */
const layout = (pages: Page[]) =>
  groups(pages)
    .map((g) => (g.section ? `${g.section.name}: ` : "") + ids(g.pages))
    .join(" | ");

describe("sections", () => {
  const pages = [page("1"), page("2", A), page("3", A), page("4", B), page("5", B)];

  test("groups runs of pages", () => {
    expect(layout(pages)).toBe("1 | A: 2 3 | B: 4 5");
    expect(groups(pages).map((g) => g.start)).toEqual([0, 1, 3]);
  });

  test("starts a section that takes the rest of the run", () => {
    expect(layout(startSection(pages, 2, "New"))).toBe("1 | A: 2 | New: 3 | B: 4 5");
    expect(layout(startSection(pages, 0, "Intro"))).toBe("Intro: 1 | A: 2 3 | B: 4 5");
  });

  test("renames and removes", () => {
    expect(layout(renameSection(pages, "a", "Week 1"))).toBe("1 | Week 1: 2 3 | B: 4 5");
    expect(layout(removeSection(pages, "b"))).toBe("1 | A: 2 3 4 5");
    expect(layout(removeSection(pages, "a"))).toBe("1 2 3 | B: 4 5");
  });

  test("moves whole sections", () => {
    expect(layout(moveGroup(pages, 3, -1))).toBe("1 | B: 4 5 | A: 2 3");
    expect(layout(moveGroup(pages, 0, 1))).toBe("A: 2 3 | 1 | B: 4 5");
    expect(moveGroup(pages, 0, -1)).toBe(pages);
  });

  test("moved pages join the section they are dropped into", () => {
    expect(layout(movePages(pages, [0], 4, B))).toBe("A: 2 3 | B: 4 1 5");
    expect(layout(movePages(pages, [3, 4], 0, null))).toBe("4 5 1 | A: 2 3");
  });

  test("a section split in two becomes two sections", () => {
    // Dropping a page of B into the middle of A splits A.
    const split = movePages([page("1", A), page("2", A), page("3", B)], [2], 1, B);
    const gs = groups(split);
    expect(layout(split)).toBe("A: 1 | B: 3 | A: 2");
    expect(gs[0].section!.id).not.toBe(gs[2].section!.id);
  });

  test("arrows cross a section boundary before moving past pages", () => {
    expect(layout(stepPage(pages, 1, -1))).toBe("1 2 | A: 3 | B: 4 5");
    expect(layout(stepPage(pages, 2, 1))).toBe("1 | A: 2 | B: 3 4 5");
    expect(layout(stepPage(pages, 4, -1))).toBe("1 | A: 2 3 | B: 5 4");
    expect(stepPage(pages, 0, -1)).toBe(pages);
  });

  test("groups selected pages into a new section where the first one was", () => {
    const grouped = groupIntoSection(pages, [4, 2], "Lecture 3");
    expect(layout(grouped)).toBe("1 | A: 2 | Lecture 3: 3 5 | B: 4");
  });

  test("never edits pages in place", () => {
    const before = structuredClone(pages);
    startSection(pages, 1, "x");
    movePages(pages, [0, 3], 2, A);
    removeSection(pages, "a");
    expect(pages).toEqual(before);
  });

  test("suggests unused names", () => {
    expect(nextSectionName(pages)).toBe("Section 3");
    expect(nextSectionName([page("1", { id: "x", name: "Section 1" })])).toBe("Section 2");
  });
});

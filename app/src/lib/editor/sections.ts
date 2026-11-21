import type { Page, PageSection } from "#lib/tauri/bindings.ts";

/*
 * Sections group consecutive pages (a lecture, a chapter). There is no
 * separate list of them: each page carries its section (`Page.section`), and
 * a section is a run of consecutive pages with the same section id. So every
 * section change is a new `pages` array, which history already records, and
 * undo needs nothing extra.
 *
 * These functions are pure: they take a pages array and return a new one,
 * never editing a page in place (see "Immutability rule" in CLAUDE.md).
 */

export interface PageGroup {
  /** `null` for pages before the first section. */
  section: PageSection | null;
  /** Index of the group's first page. */
  start: number;
  pages: Page[];
}

/** The pages as runs of consecutive pages sharing a section. */
export function groups(pages: Page[]): PageGroup[] {
  const out: PageGroup[] = [];
  pages.forEach((page, i) => {
    const last = out.at(-1);
    if (last && last.section?.id === page.section?.id) last.pages.push(page);
    else out.push({ section: page.section ?? null, start: i, pages: [page] });
  });
  return out;
}

const withSection = (p: Page, section: PageSection | null): Page =>
  p.section?.id === section?.id && p.section?.name === section?.name ? p : { ...p, section };

/**
 * Keeps sections contiguous: when a section's pages end up in two separate
 * runs (pages moved out of its middle), the later run becomes a section of
 * its own with the same name, rather than one section shown twice.
 */
export function splitRepeats(pages: Page[]): Page[] {
  const seen = new Set<string>();
  const renamed = new Map<string, PageSection>();
  let prev: string | undefined;
  return pages.map((p) => {
    const id = p.section?.id;
    if (!id) {
      prev = undefined;
      return p;
    }
    if (id !== prev) {
      if (seen.has(id)) renamed.set(id, { id: crypto.randomUUID(), name: p.section!.name });
      else renamed.delete(id);
      seen.add(id);
    }
    prev = id;
    const replacement = renamed.get(id);
    return replacement ? withSection(p, replacement) : p;
  });
}

/** Starts a new section at page `i`; it takes the rest of `i`'s run. */
export function startSection(pages: Page[], i: number, name: string): Page[] {
  const from = pages[i]?.section?.id;
  const section = { id: crypto.randomUUID(), name };
  let inRun = true;
  return pages.map((p, j) => {
    if (j < i) return p;
    inRun &&= p.section?.id === from;
    return inRun ? withSection(p, section) : p;
  });
}

export function renameSection(pages: Page[], id: string, name: string): Page[] {
  return pages.map((p) => (p.section?.id === id ? withSection(p, { id, name }) : p));
}

/** Removes a section; its pages join the section before it (or none). */
export function removeSection(pages: Page[], id: string): Page[] {
  const start = pages.findIndex((p) => p.section?.id === id);
  if (start === -1) return pages;
  const before = pages[start - 1]?.section ?? null;
  return pages.map((p) => (p.section?.id === id ? withSection(p, before) : p));
}

/** Swaps a group with the one before (-1) or after (+1) it. */
export function moveGroup(pages: Page[], start: number, dir: -1 | 1): Page[] {
  const gs = groups(pages);
  const g = gs.findIndex((x) => x.start === start);
  const other = g + dir;
  if (g === -1 || other < 0 || other >= gs.length) return pages;
  [gs[g], gs[other]] = [gs[other], gs[g]];
  return gs.flatMap((x) => x.pages);
}

/**
 * Moves the pages at `indices` (in their current order) so they sit before
 * the page at index `to` (or at the end when `to === pages.length`), and puts
 * them in `section`, the section of where they were dropped.
 */
export function movePages(
  pages: Page[],
  indices: number[],
  to: number,
  section: PageSection | null,
): Page[] {
  const moving = new Set(indices);
  const picked = pages.filter((_, i) => moving.has(i)).map((p) => withSection(p, section));
  const rest = pages.filter((_, i) => !moving.has(i));
  // `to` counted in the original array; shift it past the removed pages.
  const at = to - indices.filter((i) => i < to).length;
  rest.splice(at, 0, ...picked);
  return splitRepeats(rest);
}

/**
 * One step up (-1) or down (+1) for the arrow buttons. At a section boundary
 * the page first changes section (staying where it is), so it can be moved
 * into the end of the previous section or the start of the next one.
 */
export function stepPage(pages: Page[], i: number, dir: -1 | 1): Page[] {
  const page = pages[i];
  const neighbour = pages[i + dir];
  if (!page || !neighbour) return pages;
  if (neighbour.section?.id !== page.section?.id) {
    const out = pages.slice();
    out[i] = withSection(page, neighbour.section ?? null);
    return splitRepeats(out);
  }
  const out = pages.slice();
  [out[i], out[i + dir]] = [neighbour, page];
  return out;
}

/**
 * Gathers the pages at `indices` where the first of them is and makes them
 * a new section, e.g. "these five slides are Lecture 3".
 */
export function groupIntoSection(pages: Page[], indices: number[], name: string): Page[] {
  const sorted = [...indices].sort((a, b) => a - b);
  if (sorted.length === 0) return pages;
  const section = { id: crypto.randomUUID(), name };
  return movePages(pages, sorted, sorted[0], section);
}

/** A name like "Section 3" that no section uses yet. */
export function nextSectionName(pages: Page[]): string {
  const names = new Set(pages.map((p) => p.section?.name));
  let n = groups(pages).filter((g) => g.section).length + 1;
  while (names.has(`Section ${n}`)) n++;
  return `Section ${n}`;
}

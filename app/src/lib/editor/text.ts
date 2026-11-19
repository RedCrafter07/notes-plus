/*
 * Text layout shared by the canvas renderer, hit-testing, and the editing
 * <textarea>. All three must agree on line breaks, so they all go through
 * `layoutText`.
 */

export const TEXT_FONT_FAMILY = '"Funnel Sans Variable", sans-serif';
export const TEXT_LINE_HEIGHT = 1.35;

export function textFont(fontSize: number) {
  return `${fontSize}px ${TEXT_FONT_FAMILY}`;
}

export interface TextLayout {
  lines: string[];
  height: number;
}

/** Drops cached layouts; call when fonts finish loading. */
export function clearTextLayouts() {
  cache.clear();
}

let measureCtx: CanvasRenderingContext2D | null | undefined;
const cache = new Map<string, TextLayout>();
const CACHE_LIMIT = 500;

function measurer() {
  if (measureCtx === undefined) {
    measureCtx =
      typeof document === "undefined"
        ? null
        : document.createElement("canvas").getContext("2d");
  }
  return measureCtx;
}

/**
 * Greedy word wrap. Explicit newlines are kept; a single word wider than the
 * box is broken by characters.
 */
export function layoutText(
  text: string,
  width: number,
  fontSize: number,
): TextLayout {
  const key = `${fontSize}|${width}|${text}`;
  const hit = cache.get(key);
  if (hit) return hit;

  const ctx = measurer();
  const measure = ctx
    ? (s: string) => ctx.measureText(s).width
    : (s: string) => s.length * fontSize * 0.55; // no DOM (tests): estimate

  if (ctx) ctx.font = textFont(fontSize);

  const lines: string[] = [];
  const isSpace = (s: string) => /^\s+$/.test(s);

  for (const paragraph of text.split("\n")) {
    let line = "";
    let wrapped = false;

    const breakLine = () => {
      lines.push(line.trimEnd());
      line = "";
      wrapped = true;
    };

    for (const word of paragraph.split(/(\s+)/)) {
      if (word === "") continue;
      // Whitespace that caused a wrap is not carried to the next line.
      if (line === "" && wrapped && isSpace(word)) continue;
      if (measure(line + word) <= width) {
        line += word;
        continue;
      }
      if (isSpace(word)) {
        breakLine();
        continue;
      }
      if (line !== "") breakLine();
      if (measure(word) <= width) {
        line = word;
        continue;
      }
      // A single word wider than the box: break it by characters.
      for (const ch of word) {
        if (line !== "" && measure(line + ch) > width) breakLine();
        line += ch;
      }
    }
    lines.push(line.trimEnd());
  }

  const layout = {
    lines,
    height: Math.max(1, lines.length) * fontSize * TEXT_LINE_HEIGHT,
  };

  if (cache.size > CACHE_LIMIT) cache.clear();
  cache.set(key, layout);
  return layout;
}

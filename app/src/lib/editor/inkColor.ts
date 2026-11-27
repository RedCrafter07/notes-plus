/*
 * Ink on dark paper. Notes are written in whatever colour the swatch says,
 * usually black; on dark paper that ink would vanish. So, at draw time
 * only, an ink colour with too little contrast against dark paper is drawn
 * with its lightness flipped (in OKLab, which keeps the hue): black becomes
 * white, dark blue light blue. Colours that already stand out (red, yellow,
 * a highlighter) are drawn as they are, and nothing changes on light paper.
 * The stored colour never changes.
 *
 * "Dark pages" (a view setting) shows light paper dark in the editor
 * (`displayPaper`); the same rule then adapts the ink to it, while exports
 * and thumbnails keep the real colours.
 */

/** Paper this dark or darker (relative luminance) counts as dark. */
const DARK_PAPER = 0.2;
/** Ink with at least this contrast ratio against the paper is left alone. */
const MIN_CONTRAST = 3;

interface Rgb {
  r: number;
  g: number;
  b: number;
  /** The alpha suffix as written ("" or two hex digits), kept as it is. */
  alpha: string;
}

export function parseHex(color: string): Rgb | undefined {
  const m = /^#([0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i.exec(color.trim());
  if (!m) return;
  let h = m[1];
  if (h.length === 3) h = [...h].map((c) => c + c).join("");
  return {
    r: parseInt(h.slice(0, 2), 16) / 255,
    g: parseInt(h.slice(2, 4), 16) / 255,
    b: parseInt(h.slice(4, 6), 16) / 255,
    alpha: h.slice(6),
  };
}

function toHex({ r, g, b, alpha }: Rgb): string {
  const c = (v: number) =>
    Math.round(Math.min(1, Math.max(0, v)) * 255)
      .toString(16)
      .padStart(2, "0");
  return `#${c(r)}${c(g)}${c(b)}${alpha}`;
}

const toLinear = (c: number) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const fromLinear = (c: number) => (c <= 0.0031308 ? c * 12.92 : 1.055 * Math.max(0, c) ** (1 / 2.4) - 0.055);

/** WCAG relative luminance. */
export function luminance({ r, g, b }: Rgb): number {
  return 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b);
}

export function contrast(a: Rgb, b: Rgb): number {
  const la = luminance(a);
  const lb = luminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

function toOklab({ r, g, b }: Rgb) {
  const [lr, lg, lb] = [toLinear(r), toLinear(g), toLinear(b)];
  const l = Math.cbrt(0.4122214708 * lr + 0.5363325363 * lg + 0.0514459929 * lb);
  const m = Math.cbrt(0.2119034982 * lr + 0.6806995451 * lg + 0.1073969566 * lb);
  const s = Math.cbrt(0.0883024619 * lr + 0.2817188376 * lg + 0.6299787005 * lb);
  return {
    L: 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    a: 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    b: 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  };
}

function fromOklab(L: number, a: number, b: number, alpha: string): Rgb {
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
  return {
    r: fromLinear(4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s),
    g: fromLinear(-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s),
    b: fromLinear(-0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s),
    alpha,
  };
}

export function isDarkPaper(paper: string): boolean {
  const p = parseHex(paper);
  return !!p && luminance(p) <= DARK_PAPER;
}

const cache = new Map<string, string>();

/** The colour to draw `color` ink in on `paper` (see the top of this file). */
export function adaptInk(color: string, paper: string): string {
  const key = `${color}|${paper}`;
  let out = cache.get(key);
  if (out === undefined) {
    out = adapt(color, paper);
    if (cache.size > 512) cache.clear();
    cache.set(key, out);
  }
  return out;
}

function adapt(color: string, paper: string): string {
  const p = parseHex(paper);
  const c = parseHex(color);
  if (!p || !c || luminance(p) > DARK_PAPER || contrast(c, p) >= MIN_CONTRAST) return color;
  const lab = toOklab(c);
  // Flip the lightness; brighten further if that is still too faint.
  let L = 1 - lab.L;
  let rgb = fromOklab(L, lab.a, lab.b, c.alpha);
  while (contrast(rgb, p) < MIN_CONTRAST && L < 1) {
    L = Math.min(1, L + 0.05);
    rgb = fromOklab(L, lab.a, lab.b, c.alpha);
  }
  return toHex(rgb);
}

/** Paper colours as shown, with "Dark pages" on or off. */
export interface PaperColors {
  background: string;
  pattern: string;
  /** Shown darker than it is (so e.g. a PDF background is inverted too). */
  inverted: boolean;
}

/** Lightness of white paper when shown dark (OKLab L). */
const DARK_WHITE = 0.18;

/**
 * Light paper shown dark: lightness flipped into a dark range, so white
 * becomes dark grey and the ruling stays a little lighter than the paper.
 * Paper that is already dark is shown as it is.
 */
export function displayPaper(background: string, pattern: string, darkPages: boolean): PaperColors {
  const bg = parseHex(background);
  if (!darkPages || !bg || luminance(bg) <= DARK_PAPER) return { background, pattern, inverted: false };
  const flip = (color: string) => {
    const c = parseHex(color);
    if (!c) return color;
    const lab = toOklab(c);
    return toHex(fromOklab(DARK_WHITE + (1 - lab.L) * (1 - DARK_WHITE), lab.a, lab.b, c.alpha));
  };
  return { background: flip(background), pattern: flip(pattern), inverted: true };
}

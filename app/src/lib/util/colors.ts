// The formulas have been provided by Claude Haiku 4.6
export function hsvToHsl(
  hsv: [number, number, number],
): [number, number, number] {
  const [h, s, v] = hsv;

  const l = v * (1 - s / 2);
  const s1 = (v - l) / Math.min(l, 1 - l);

  return [h, s1, l];
}

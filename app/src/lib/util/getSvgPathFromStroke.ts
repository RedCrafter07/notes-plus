export function getSvgPathFromStroke(stroke: [number, number][]) {
  if (!stroke.length) return "";

  // Taken from https://github.com/steveruizok/perfect-freehand/blob/main/tutorial/script.md#smoothing
  const d = stroke
    .reduce(
      (acc, [x0, y0], i, arr) => {
        const [x1, y1] = arr[(i + 1) % arr.length];
        acc.push(x0, y0, (x0 + x1) / 2, (y0 + y1) / 2);
        return acc;
      },
      ["M", ...stroke[0], "Q"],
    )
    .concat("Z")
    .join(" ");

  return d;
}

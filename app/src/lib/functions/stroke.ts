export type Point = {
  x: number;
  y: number;
  pressure: number;
};
export type OutlinePoint = Record<"x" | "y", number>;

export function generateData(
  input: Point[],
  width: number = 5,
): OutlinePoint[] {
  if (input.length < 2) return []; // A path needs at least two points

  // Use reduce to create two arrays of outline points (top and bottom)
  const outlines = input
    .map(({ x, y, pressure }, i, a) => {
      const prev = a[i - 1] || a[i];
      const next = a[i + 1] || a[i];

      const vector = {
        x: (next.x - prev.x) / 2,
        y: (next.y - prev.y) / 2,
      };

      const normal = { x: -vector.y, y: vector.x };

      const length = Math.sqrt(normal.x ** 2 + normal.y ** 2);
      const unitNormal =
        length > 0
          ? { x: normal.x / length, y: normal.y / length }
          : { x: 0, y: 0 };

      const distancePerSide = width * pressure;

      return [
        {
          x: x - unitNormal.x * distancePerSide,
          y: y - unitNormal.y * distancePerSide,
        },
        {
          x: x + unitNormal.x * distancePerSide,
          y: y + unitNormal.y * distancePerSide,
        },
      ] as [OutlinePoint, OutlinePoint];
    })
    .reduce(
      (acc, [topPoint, bottomPoint]) => {
        acc.top.push(topPoint);
        acc.bottom.push(bottomPoint);
        return acc;
      },
      { top: [], bottom: [] } as Record<"top" | "bottom", OutlinePoint[]>,
    );

  const path = [...outlines.top, ...outlines.bottom.slice().reverse()];

  return path;
}

export function buildPath(input: OutlinePoint[]): string {
  let path = "";
  console.log(input.length, input[0]);

  for (let i = 0; i <= input.length - 1; i++) {
    const p0 = input[i];
    const p1 = i === input.length - 1 ? input[0] : input[i + 1];

    const midPoint = { x: (p0.x + p1.x) / 2, y: (p0.y + p1.y) / 2 };

    if (i === 0) {
      path += `M${p0.x},${p0.y} `;
    }

    path += `Q${p0.x},${p0.y} ${midPoint.x},${midPoint.y} `;
  }

  path += "Z";

  return path;
}

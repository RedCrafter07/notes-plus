export type Point = {
  x: number;
  y: number;
  pressure: number;
};

export function generateData(input: Point[], width: number = 5): string {
  if (input.length < 2) return ""; // A path needs at least two points

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
          x: x + unitNormal.x * distancePerSide,
          y: y + unitNormal.y * distancePerSide,
          pressure,
        },
        {
          x: x - unitNormal.x * distancePerSide,
          y: y - unitNormal.y * distancePerSide,
          pressure,
        },
      ] as [Point, Point];
    })
    .reduce(
      (acc, [topPoint, bottomPoint]) => {
        acc.top.push(topPoint);
        acc.bottom.push(bottomPoint);
        return acc;
      },
      { top: [], bottom: [] } as Record<"top" | "bottom", Point[]>,
    );

  // --- Construct the SVG path string ---

  const topPath = outlines.top
    .map((p0, i, a) => {
      if (i === a.length - 1) return ""; // Skip the last point

      const p1 = a[i + 1];

      const midPoint = { x: (p0.x + p1.x) / 2, y: (p0.y + p1.y) / 2 };

      if (i === 0) {
        return `M${p0.x},${p0.y} Q${p0.x},${p0.y} ${midPoint.x},${midPoint.y}`;
      }
      return `Q${p0.x},${p0.y} ${midPoint.x},${midPoint.y}`;
    })
    .join(" ");

  const bottomPath = outlines.bottom
    .slice()
    .reverse()
    .map((p0, i, a) => {
      if (i === a.length - 1) return "";

      const p1 = a[i + 1];
      const midPoint = { x: (p0.x + p1.x) / 2, y: (p0.y + p1.y) / 2 };

      if (i === 0) {
        return `L${p0.x},${p0.y} Q${p0.x},${p0.y} ${midPoint.x},${midPoint.y}`;
      }
      return `Q${p0.x},${p0.y} ${midPoint.x},${midPoint.y}`;
    })
    .join(" ");

  return `${topPath} ${bottomPath} Z`;
}

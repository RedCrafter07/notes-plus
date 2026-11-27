/*
 * Order within a layer: later in `Layer.blocks` is drawn on top. Arranging
 * returns a new array (the immutability rule) and keeps the selected
 * blocks in their order relative to each other.
 */

export type Arrange = "front" | "back" | "forward" | "backward";

export function arrange<T extends { id: string }>(blocks: T[], selected: Set<string>, how: Arrange): T[] {
  const isSel = (b: T) => selected.has(b.id);
  switch (how) {
    case "front":
      return [...blocks.filter((b) => !isSel(b)), ...blocks.filter(isSel)];
    case "back":
      return [...blocks.filter(isSel), ...blocks.filter((b) => !isSel(b))];
    case "forward": {
      // From the top down, so a run of selected blocks moves as one.
      const out = [...blocks];
      for (let i = out.length - 2; i >= 0; i--)
        if (isSel(out[i]) && !isSel(out[i + 1])) [out[i], out[i + 1]] = [out[i + 1], out[i]];
      return out;
    }
    case "backward": {
      const out = [...blocks];
      for (let i = 1; i < out.length; i++)
        if (isSel(out[i]) && !isSel(out[i - 1])) [out[i], out[i - 1]] = [out[i - 1], out[i]];
      return out;
    }
  }
}

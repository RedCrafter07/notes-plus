<script lang="ts">
  import type { BackgroundPattern } from "#lib/tauri/bindings.ts";
  import { dotCopies, lineCopies, paperGuides, paperTile } from "./paper";

  /** A static preview of a paper pattern (the live page uses Paper.svelte). */
  const {
    color,
    scale,
    pattern,
  }: {
    color: string;
    scale: number;
    pattern: BackgroundPattern | null;
    uuid?: boolean;
  } = $props();

  const id = $props.id();
  const tile = $derived(paperTile(pattern, scale));
  /** Guides as percentages of the preview (a page of 1000 x 1000). */
  const guides = $derived(paperGuides({ pattern, width: 1000, height: 1000 }));
</script>

<svg width="100%" height="100%">
  {#if tile}
    <defs>
      <pattern {id} width={tile.width} height={tile.height} patternUnits="userSpaceOnUse">
        {#each tile.rules as y, i (i)}
          <rect x="0" {y} width={tile.width} height="1" fill={color} />
        {/each}
        {#each tile.columns as x, i (i)}
          <rect {x} y="0" width="1" height={tile.height} fill={color} />
        {/each}
        {#each lineCopies(tile) as [x1, y1, x2, y2], i (i)}
          <line {x1} {y1} {x2} {y2} stroke={color} stroke-width="1" />
        {/each}
        {#each dotCopies(tile) as [cx, cy], i (i)}
          <circle {cx} {cy} r={1.2} fill={color} />
        {/each}
      </pattern>
    </defs>
    <rect width="100%" height="100%" fill="url(#{id})" />
  {/if}
  {#each guides as g, i (i)}
    <line
      x1="{g.x1 / 10}%"
      y1="{g.y1 / 10}%"
      x2="{g.x2 / 10}%"
      y2="{g.y2 / 10}%"
      stroke={g.color ?? color}
      stroke-width={g.weight}
    />
  {/each}
</svg>

<script lang="ts">
  import type { BackgroundPattern } from "$lib/tauri/bindings";
  import { contentManager } from "$lib/state/contentManager.svelte";
  import { canvasManager } from "$lib/editor/state/canvasManager.svelte";

  const {
    color,
    scale,
    pattern,
  }: {
    color: string;
    scale: number;
    pattern: BackgroundPattern | null;
  } = $props();

  const zoomedScale = $derived(scale * contentManager.zoom);
  const offsetX = $derived(
    (-contentManager.panX * contentManager.zoom) % zoomedScale,
  );
  const offsetY = $derived(
    (-contentManager.panY * contentManager.zoom) % zoomedScale,
  );
</script>

<svg width="100%" height="100%">
  <defs>
    <pattern
      id="bg-pattern-{pattern}"
      x={offsetX}
      y={offsetY}
      width={zoomedScale}
      height={zoomedScale}
      patternUnits="userSpaceOnUse"
    >
      {#if pattern === "Dots"}
        <circle
          cx={zoomedScale / 2}
          cy={zoomedScale / 2}
          r={1.5 * contentManager.zoom}
          fill={color}
        />
      {:else if pattern === "Lines"}
        <line
          x1="0"
          y1={0}
          x2={canvasManager.width}
          y2={0}
          stroke={color}
          stroke-width={1}
        />
      {:else if pattern === "Squares"}
        <rect
          x="0"
          y="0"
          width={zoomedScale}
          height={zoomedScale}
          fill="none"
          stroke={color}
          stroke-width={1 * contentManager.zoom}
        />
      {/if}
    </pattern>
  </defs>
  <g
    transform={`translate(${canvasManager.width / 2}, ${canvasManager.height / 2})`}
  >
    <rect
      x={-canvasManager.width / 2}
      y={-canvasManager.height / 2}
      width={canvasManager.width}
      height={canvasManager.height}
      fill="url(#bg-pattern-{pattern})"
    />
  </g>
</svg>

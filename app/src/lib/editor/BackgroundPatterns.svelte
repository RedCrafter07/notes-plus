<script lang="ts">
  import type { BackgroundPattern } from "$lib/tauri/bindings";
  import { contentManager } from "$lib/state/contentManager.svelte";
  import { canvasManager } from "$lib/editor/state/canvasManager.svelte";

  const {
    color,
    scale,
    pattern,
    zoom,
  }: {
    color: string;
    scale: number;
    pattern: BackgroundPattern | null;
    zoom?: boolean;
  } = $props();

  const zoomedScale = $derived(zoom ? scale * contentManager.zoom : scale);
  const offsetX = $derived(
    zoom ? (contentManager.panX * contentManager.zoom) % zoomedScale : 0,
  );
  const offsetY = $derived(
    zoom ? (contentManager.panY * contentManager.zoom) % zoomedScale : 0,
  );
  const actualZoom = $derived(zoom ? contentManager.zoom : 1);
</script>

<svg width="100%" height="100%">
  <defs>
    <pattern
      id="bg-pattern-{pattern}"
      x={offsetX}
      y={offsetY}
      width={zoom ? zoomedScale : scale}
      height={zoom ? zoomedScale : scale}
      patternUnits="userSpaceOnUse"
    >
      {#if pattern === "Dots"}
        <circle cx={0} cy={0} r={1.5 * actualZoom} fill={color} />
        <circle cx={zoomedScale} cy={0} r={1.5 * actualZoom} fill={color} />
        <circle cx={0} cy={zoomedScale} r={1.5 * actualZoom} fill={color} />
        <circle
          cx={zoomedScale}
          cy={zoomedScale}
          r={1.5 * actualZoom}
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
          stroke-width={1 * actualZoom}
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

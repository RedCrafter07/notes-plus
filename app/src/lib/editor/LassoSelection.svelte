<script lang="ts">
  import { lassoManager } from "$lib/editor/state/lassoManager.svelte";
  import { contentManager } from "$lib/state/contentManager.svelte";
  import { fade } from "svelte/transition";
  import { inputToPath } from "./svg";
  import { canvasManager } from "./state/canvasManager.svelte";
</script>

{#if lassoManager.selection}
  <g
    transform="translate({lassoManager.dragOffsetX}, {lassoManager.dragOffsetY})"
  >
    {#each lassoManager.selectedLayers as l}
      {#each lassoManager.selection[l] as e}
        {@const stroke = e.block.Stroke}
        <path
          d={inputToPath(stroke.points, stroke.thickness, false)}
          fill={stroke.color}
        />
      {/each}
    {/each}
    <rect
      x={lassoManager.boundingBox?.x}
      y={lassoManager.boundingBox?.y}
      width={lassoManager.boundingBox?.width}
      height={lassoManager.boundingBox?.height}
      fill="transparent"
      stroke="var(--base-1)"
      stroke-dasharray={`${5 / contentManager.zoom}`}
      stroke-width={2 / contentManager.zoom}
      class="cursor-move pointer-events-auto"
      role="group"
    />
  </g>
{/if}
{#if canvasManager.tool === "lasso" && lassoManager.points.length > 0 && lassoManager.isSelecting}
  <path
    out:fade={{ duration: 100 }}
    d={"M " +
      lassoManager.points.map((p) => `${p.x},${p.y}`).join(" L ") +
      " Z"}
    fill="rgba(0, 120, 255, 0.1)"
    stroke="#0078FF"
    stroke-width={2 / contentManager.zoom}
    stroke-dasharray={`${5 / contentManager.zoom}, ${5 / contentManager.zoom}`}
  />
{/if}

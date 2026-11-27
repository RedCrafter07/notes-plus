<script lang="ts">
  import { lassoManager } from "#lib/editor/state/lassoManager.svelte.ts";
  import { contentManager } from "#lib/state/contentManager.svelte.ts";
  import { fade } from "svelte/transition";
  import { canvasManager } from "./state/canvasManager.svelte";
</script>

{#if lassoManager.selection}
  {@const s = lassoManager.scaling}
  {@const g = lassoManager.gesture}
  <!-- The selected blocks are drawn on the selection canvas; this is only the
       frame, moved, scaled or rotated with it while a gesture previews. -->
  <g
    transform={g
      ? `translate(${g.to.x} ${g.to.y}) rotate(${(g.angle * 180) / Math.PI}) scale(${g.scale}) translate(${-g.from.x} ${-g.from.y})`
      : s
        ? `translate(${s.anchor.x} ${s.anchor.y}) scale(${s.factor}) translate(${-s.anchor.x} ${-s.anchor.y})`
        : `translate(${lassoManager.dragOffsetX}, ${lassoManager.dragOffsetY})`}
  >
    <rect
      transition:fade={{ duration: 100 }}
      x={lassoManager.boundingBox?.x}
      y={lassoManager.boundingBox?.y}
      width={lassoManager.boundingBox?.width}
      height={lassoManager.boundingBox?.height}
      fill="transparent"
      stroke="var(--primary)"
      stroke-dasharray={`${5 / contentManager.zoom}`}
      stroke-width={2 / contentManager.zoom}
      class="cursor-move"
    />
  </g>
  <!-- Corner handles: drag one to scale (see lassoManager.scaling). Hidden
       during a gesture; the hit area is larger than the drawn square. -->
  {#if !s && !g && !lassoManager.isDraggingSelection}
    {@const size = 10 / contentManager.zoom}
    {#each lassoManager.corners as c, i (i)}
      <rect
        x={c.x - size / 2}
        y={c.y - size / 2}
        width={size}
        height={size}
        rx={2 / contentManager.zoom}
        fill="var(--base-1)"
        stroke="var(--primary)"
        stroke-width={2 / contentManager.zoom}
      />
    {/each}
  {/if}
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

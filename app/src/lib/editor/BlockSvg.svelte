<script lang="ts">
  import { contentManager } from "#lib/state/contentManager.svelte.ts";
  import type { Block } from "#lib/tauri/bindings.ts";
  import { strokeToPath } from "./svg";
  import { layoutText, TEXT_FONT_FAMILY, TEXT_LINE_HEIGHT } from "./text";

  /** SVG rendering of a block; mirrors `drawBlock` in render/draw.ts. */
  let { block: b }: { block: Block } = $props();
</script>

{#if b.type === "Stroke"}
  <path
    d={strokeToPath(b)}
    fill={b.color}
    fill-opacity={b.opacity}
  />
{:else if b.type === "Text"}
  {@const lh = b.font_size * TEXT_LINE_HEIGHT}
  {#each layoutText(b.text, b.width, b.font_size).lines as line, i}
    <text
      x={b.x}
      y={b.y + i * lh + lh / 2}
      dominant-baseline="central"
      fill={b.color}
      font-size={b.font_size}
      font-family={TEXT_FONT_FAMILY}
      style="white-space: pre">{line}</text
    >
  {/each}
{:else if b.type === "Image"}
  <image
    href={contentManager.assets(b.asset)}
    x={b.x}
    y={b.y}
    width={b.width}
    height={b.height}
    preserveAspectRatio="none"
  />
{/if}

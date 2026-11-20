<script lang="ts">
  import type { BackgroundPattern } from "#lib/tauri/bindings.ts";

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
</script>

<svg width="100%" height="100%">
  <defs>
    <pattern {id} width={scale} height={scale} patternUnits="userSpaceOnUse">
      {#if pattern === "Dots"}
        <circle cx={scale / 2} cy={scale / 2} r={1.2} fill={color} />
      {:else if pattern === "Lines"}
        <rect x="0" y={scale - 1} width={scale} height="1" fill={color} />
      {:else if pattern === "Squares"}
        <rect x="0" y="0" width={scale} height="1" fill={color} />
        <rect x="0" y="0" width="1" height={scale} fill={color} />
      {/if}
    </pattern>
  </defs>
  <rect width="100%" height="100%" fill="url(#{id})" />
</svg>

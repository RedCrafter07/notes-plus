<script lang="ts">
  import { contentManager } from "#lib/state/contentManager.svelte.ts";
  import { canvasManager } from "./state/canvasManager.svelte";
  import { pageRect } from "./pageFormats";

  /*
   * The sheet under the ink: paper colour, imported PDF page, and ruling.
   * Drawn as SVG in content coordinates (the viewBox follows pan/zoom), so
   * the ruling stays locked to the page while the browser does the tiling.
   * A fixed page sits on a darker "desk" with a shadow; an infinite page is
   * paper everywhere.
   */

  const uid = $props.id();
  const page = $derived(contentManager.page);
  const rect = $derived(pageRect(page));
  const view = $derived(canvasManager.viewBounds());
  const area = $derived(rect ?? view);
  const zoom = $derived(contentManager.zoom);
  const s = $derived(page.pattern_scale);
  /** One screen pixel, in content units. */
  const px = $derived(1 / zoom);
  const background = $derived(
    page.background_asset ? contentManager.assets(page.background_asset) : undefined,
  );
  const screen = $derived(
    rect
      ? {
          ...canvasManager.translateToAbsolute(rect.min),
          w: rect.width * zoom,
          h: rect.height * zoom,
        }
      : undefined,
  );
</script>

{#if screen}
  <!-- Paper colour and shadow; a div is far cheaper to shadow than SVG. -->
  <div
    class="absolute pointer-events-none shadow-[0_2px_16px_rgba(0,0,0,0.45)]"
    style="left: {screen.x}px; top: {screen.y}px; width: {screen.w}px; height: {screen.h}px; background-color: {page.background_color};"
  ></div>
{:else}
  <div
    class="absolute inset-0 pointer-events-none"
    style="background-color: {page.background_color};"
  ></div>
{/if}

<svg
  class="absolute inset-0 w-full h-full pointer-events-none"
  viewBox="{view.min.x} {view.min.y} {view.width} {view.height}"
  preserveAspectRatio="none"
>
  <defs>
    <pattern
      id="paper-{uid}"
      patternUnits="userSpaceOnUse"
      width={s}
      height={s}
      x={page.pattern === "Dots" ? -s / 2 : 0}
      y={page.pattern === "Dots" ? -s / 2 : 0}
    >
      {#if page.pattern === "Dots"}
        <circle cx={s / 2} cy={s / 2} r={1.5} fill={page.pattern_color} />
      {:else if page.pattern === "Lines"}
        <rect x="0" y="0" width={s} height={px} fill={page.pattern_color} />
      {:else if page.pattern === "Squares"}
        <rect x="0" y="0" width={s} height={px} fill={page.pattern_color} />
        <rect x="0" y="0" width={px} height={s} fill={page.pattern_color} />
      {/if}
    </pattern>
  </defs>

  {#if background && rect}
    <image
      href={background}
      x={rect.min.x}
      y={rect.min.y}
      width={rect.width}
      height={rect.height}
      preserveAspectRatio="none"
      class="transition-opacity"
      opacity={canvasManager.dimmed ? 0.35 : 1}
    />
  {/if}
  {#if page.pattern}
    <rect
      x={area.min.x}
      y={area.min.y}
      width={area.width}
      height={area.height}
      fill="url(#paper-{uid})"
    />
  {/if}
</svg>

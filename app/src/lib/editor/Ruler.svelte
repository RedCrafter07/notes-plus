<script lang="ts">
  import { contentManager } from "#lib/state/contentManager.svelte.ts";
  import { rulerDegrees } from "./ruler";
  import { rulerManager } from "./state/rulerManager.svelte";

  /** Page units per millimetre (96 units per inch). */
  const MM = 96 / 25.4;

  const zoom = $derived(contentManager.zoom);
  const hw = $derived(rulerManager.halfWidth);
  const hl = $derived(rulerManager.halfLength);
  /** Finest tick that stays at least 4 px apart on screen: 1, 5 or 10 mm. */
  const step = $derived([1, 5, 10].find((s) => s * MM * zoom >= 4) ?? 10);
  /** Centimetres between labels: at least 28 px apart. */
  const labelEvery = $derived([1, 5, 10, 50].find((s) => s * 10 * MM * zoom >= 28) ?? 100);

  // Ticks on both long edges, 0 at the centre; longer every 5 mm and every cm.
  const ticks = $derived.by(() => {
    const n = Math.floor(hl / (step * MM));
    let d = "";
    for (let i = -n; i <= n; i++) {
      const mm = i * step;
      const len = (mm % 10 === 0 ? 16 : mm % 5 === 0 ? 10 : 6) / zoom;
      const x = mm * MM;
      d += `M${x} ${-hw}v${len}M${x} ${hw}v${-len}`;
    }
    return d;
  });

  const labels = $derived.by(() => {
    const n = Math.floor(hl / (labelEvery * 10 * MM));
    return Array.from({ length: 2 * n + 1 }, (_, i) => (i - n) * labelEvery);
  });
</script>

{#if rulerManager.visible}
  {@const p = rulerManager.pose}
  <g transform="translate({p.center.x} {p.center.y}) rotate({(p.angle * 180) / Math.PI})">
    <rect
      x={-hl}
      y={-hw}
      width={2 * hl}
      height={2 * hw}
      class="fill-base-3/60 stroke-content-2"
      stroke-width="1"
      vector-effect="non-scaling-stroke"
    />
    <path d={ticks} class="stroke-content-1" stroke-width="1" vector-effect="non-scaling-stroke" />
    <g class="fill-content-1" font-size={10 / zoom} text-anchor="middle">
      {#each labels as cm (cm)}
        {#if cm !== 0}
          <text x={cm * 10 * MM} y={-hw + 27 / zoom}>{Math.abs(cm)}</text>
        {/if}
      {/each}
    </g>
    <text
      class="fill-primary font-semibold"
      font-size={13 / zoom}
      text-anchor="middle"
      dominant-baseline="central"
    >
      {rulerDegrees(p.angle)}°
    </text>
  </g>
{/if}

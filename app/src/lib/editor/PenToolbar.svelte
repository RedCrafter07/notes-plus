<script lang="ts">
  import { Tween } from "svelte/motion";
  import { canvasManager } from "./state/canvasManager.svelte";
  import { quintOut } from "svelte/easing";
  import { toRadian } from "$lib/util/geometry";
  import { IconPlus } from "@tabler/icons-svelte";
  import { settingsStore } from "$lib/state/settingsStore.svelte";
  import ColorEditPopup from "$lib/components/ColorEditPopup.svelte";
  import { commands } from "$lib/tauri/bindings";

  let { radius }: { radius: number } = $props();
  const visible = $derived(canvasManager.tool === "pen");

  const R = $derived((radius * 6) / 5);
  const R2 = $derived((radius * 8) / 5);
  const R3 = $derived((radius * 17) / 10);

  let expansion = new Tween(0, {
    duration: 300,
    easing: quintOut,
  });

  $effect(() => {
    expansion.target = visible ? 1 : 0;
  });

  const colors = $derived(settingsStore.store.colors ?? []);

  // Index of the swatch currently open in the edit popup, or null when closed.
  let editingIndex = $state<number | null>(null);

  // Keep the active drawing color following the swatch while it is edited.
  $effect(() => {
    if (editingIndex !== null) canvasManager.color = colors[editingIndex];
  });

  async function persistColors() {
    // Best-effort persistence: no-ops gracefully on builds without the command.
    await commands.setColors($state.snapshot(settingsStore.store.colors));
  }

  function openEditor(index: number) {
    editingIndex = index;
  }

  function addColor() {
    settingsStore.store.colors.push(canvasManager.color || "#000000");
    openEditor(settingsStore.store.colors.length - 1);
  }

  function closeEditor() {
    editingIndex = null;
    persistColors();
  }

  function deleteColor() {
    if (editingIndex === null) return;
    settingsStore.store.colors.splice(editingIndex, 1);
    editingIndex = null;
    persistColors();
  }

  function iconPos(i: number, n: number) {
    const angle = toRadian(270 - ((i + 0.5) / n) * 180); // halfway between start and end of the angle
    const x = R3 + ((R + R2) / 2) * Math.cos(angle);
    const y = R3 + ((R + R2) / 2) * Math.sin(angle);
    return { x, y };
  }

  const plusIconPos = $derived(iconPos(colors.length, colors.length + 1));

  const selectedIndex = new Tween(0, {
    duration: 200,
    easing: quintOut,
  });
  let activePath = $derived(selectedPath());

  $effect(() => {
    selectedIndex.target = colors.findIndex((c) => canvasManager.color === c);
  });

  function toOutlinePath(
    i: number,
    n: number = colors.length + 1,
    C: number = R3,
    r: number = R,
    r2: number = R2,
    part = expansion.current,
  ) {
    const startDeg = toRadian(270 - (i / n) * 180);
    const endDeg = toRadian(270 - ((i + 1) / n) * 180);

    const animatedR2 = r + (r2 - r) * part;

    const x1 = C + r * Math.cos(startDeg);
    const y1 = C + r * Math.sin(startDeg);
    const x2 = C + animatedR2 * Math.cos(startDeg);
    const y2 = C + animatedR2 * Math.sin(startDeg);
    const x3 = C + animatedR2 * Math.cos(endDeg);
    const y3 = C + animatedR2 * Math.sin(endDeg);
    const x4 = C + r * Math.cos(endDeg);
    const y4 = C + r * Math.sin(endDeg);

    return `M ${x1} ${y1} L ${x2} ${y2} A ${animatedR2} ${animatedR2} 0 0 0 ${x3} ${y3} L ${x4} ${y4} A ${r} ${r} 0 0 1 ${x1} ${y1}`;
  }

  function selectedPath(
    i: number = selectedIndex.current,
    n: number = colors.length + 1,
  ) {
    return toOutlinePath(i, n, R3, R2, R3);
  }
</script>

<!--
  The svg itself is pointer-events-none so its (invisible) bounding box does
  not intercept drawing over the canvas; only the interactive swatches and the
  add button opt back in with pointer-events-auto.
-->
<svg
  class="absolute top-1/2 right-0 -translate-y-1/2 pointer-events-none"
  width={R3}
  height={R3 * 2}
>
  <path
    d={toOutlinePath(0, 1, R3, radius - 1, R + 1, expansion.current)}
    class="fill-base-3 pointer-events-auto"
  />
  <path d={activePath} class="fill-primary" />
  {#each colors as color, i}
    {@const active = color === canvasManager.color}
    {@const path = toOutlinePath(i)}
    <g
      role="button"
      tabindex="0"
      aria-label={color}
      aria-pressed={active}
      class="pointer-events-auto cursor-pointer"
      onclick={() => {
        canvasManager.color = color;
      }}
      ondblclick={() => openEditor(i)}
      onkeydown={(e) => {
        e.preventDefault();
      }}
    >
      <path d={path} fill={color} />
    </g>
  {/each}
  <g
    role="button"
    tabindex="0"
    aria-label="Add color"
    class="pointer-events-auto cursor-pointer"
    onclick={addColor}
    onkeydown={(e) => {
      e.preventDefault();
    }}
  >
    <path d={toOutlinePath(colors.length)} class="fill-base-1" />
    <foreignObject
      x={plusIconPos.x - 15}
      y={plusIconPos.y - 15}
      width="30"
      height="30"
      class="pointer-events-none overflow-hidden"
    >
      <div
        class="w-full h-full flex items-center justify-center transition-colors text-content-1"
        style="opacity:{expansion.current * 100}%;"
      >
        <IconPlus />
      </div>
    </foreignObject>
  </g>
</svg>

{#if editingIndex !== null}
  {@const idx = editingIndex}
  <ColorEditPopup
    bind:value={settingsStore.store.colors[idx]}
    canDelete={colors.length > 1}
    onClose={closeEditor}
    onDelete={deleteColor}
  />
{/if}

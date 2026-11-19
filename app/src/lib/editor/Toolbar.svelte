<script lang="ts">
  import {
    IconArrowBackUp,
    IconArrowForwardUp,
    IconPhotoPlus,
    IconPlus,
  } from "@tabler/icons-svelte";
  import { fade } from "svelte/transition";
  import ColorEditPopup from "$lib/components/ColorEditPopup.svelte";
  import { settingsStore, updateSettings } from "$lib/state/settingsStore.svelte";
  import { tabManager } from "$lib/state/tabManager.svelte";
  import { canvasManager } from "./state/canvasManager.svelte";
  import { textEditor } from "./state/textEditor.svelte";
  import { TOOL_IDS, toolDef, type Tool } from "./tools/registry";
  import { insertImageFile, pickFiles } from "./import/image";

  /*
   * A horizontal bar at the top centre: away from the palm of a right-handed
   * writer, and with room for colour and size, which the old radial menu had
   * no space for.
   */

  const LONG_PRESS_MS = 450;

  const btnBase =
    "w-11 h-11 shrink-0 grid place-items-center rounded-xl transition-all active:scale-90 disabled:opacity-30 disabled:pointer-events-none";
  const btnIdle = "text-content-2 hover:bg-overlay/30 hover:text-content-1";
  const btn = `${btnBase} ${btnIdle}`;
  const btnOn = (active: boolean) =>
    `${btnBase} ${active ? "bg-primary text-base-1" : btnIdle}`;

  const def = $derived(toolDef(canvasManager.tool));
  const colors = $derived(settingsStore.store.colors ?? []);
  const history = $derived(tabManager.tab?.history);

  /** Index of the swatch open in the edit popup, or null when closed. */
  let editingIndex = $state<number | null>(null);
  let sizeOpen = $state(false);

  function selectTool(t: Tool) {
    canvasManager.tool = t;
    sizeOpen = false;
  }

  function setColor(c: string) {
    canvasManager.color = c;
    // Recolour the open text box too; the toolbar does not steal its focus.
    if (textEditor.draft) textEditor.draft.color = c;
  }

  function setSize(v: number) {
    canvasManager.size = v;
    if (canvasManager.tool === "text" && textEditor.draft)
      textEditor.draft.fontSize = v;
  }

  // Keep the drawing colour following the swatch while it is edited.
  $effect(() => {
    if (editingIndex !== null && colors[editingIndex])
      setColor(colors[editingIndex]);
  });

  async function persistColors() {
    await updateSettings({ colors: $state.snapshot(settingsStore.store.colors) });
  }

  function addColor() {
    settingsStore.store.colors.push(canvasManager.color || "#000000");
    editingIndex = settingsStore.store.colors.length - 1;
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

  // Swatches: tap selects, tapping the selected one (or a long press) edits.
  // Double-click was unreliable with a stylus.
  let pressTimer: ReturnType<typeof setTimeout> | undefined;
  let longPressed = false;

  function swatchDown(i: number) {
    longPressed = false;
    pressTimer = setTimeout(() => {
      longPressed = true;
      editingIndex = i;
    }, LONG_PRESS_MS);
  }

  function swatchUp() {
    clearTimeout(pressTimer);
  }

  function swatchClick(i: number, color: string) {
    if (longPressed) return;
    if (canvasManager.color === color) editingIndex = i;
    else setColor(color);
  }

  async function insertImage() {
    const [file] = await pickFiles("image/*");
    if (file) await insertImageFile(file);
  }

  /** Dot size for a size preset, scaled into the 6–22 px range. */
  function dot(v: number) {
    const s = def.size!;
    return 6 + ((v - s.min) / (s.max - s.min)) * 16;
  }
</script>

{#snippet sep()}
  <div class="w-px self-stretch my-1 bg-content-1/10 shrink-0"></div>
{/snippet}

<!--
  mousedown is prevented so pressing a button never steals focus from an open
  text box (which would commit it before the colour/size change lands).
-->
<div
  class="absolute top-3 left-1/2 -translate-x-1/2 z-20 max-w-[calc(100%-1.5rem)]"
  role="toolbar"
  aria-label="Editor tools"
  tabindex="-1"
  onmousedown={(e) => {
    if (!(e.target instanceof HTMLInputElement)) e.preventDefault();
  }}
>
  <div
    class="flex flex-row items-center gap-1 p-1.5 rounded-2xl bg-base-1/95 shadow-lg border border-content-1/10 overflow-x-auto hide-scrollbars"
  >
    <button
      class={btn}
      disabled={!history?.canUndo}
      onclick={() => tabManager.undo()}
      aria-label="Undo"
      title={history?.undoLabel ? `Undo ${history.undoLabel}` : "Undo"}
    >
      <IconArrowBackUp />
    </button>
    <button
      class={btn}
      disabled={!history?.canRedo}
      onclick={() => tabManager.redo()}
      aria-label="Redo"
      title={history?.redoLabel ? `Redo ${history.redoLabel}` : "Redo"}
    >
      <IconArrowForwardUp />
    </button>

    {@render sep()}

    {#each TOOL_IDS as id (id)}
      {@const t = toolDef(id)}
      {@const active = canvasManager.tool === id}
      <button
        class={btnOn(active)}
        onclick={() => selectTool(id)}
        aria-label={t.label}
        aria-pressed={active}
        title={t.label}
      >
        <t.icon />
      </button>
    {/each}
    <button
      class={btn}
      onclick={insertImage}
      aria-label="Insert image"
      title="Insert image"
    >
      <IconPhotoPlus />
    </button>

    {#if def.colored}
      {@render sep()}
      {#each colors as color, i (`${i}-${color}`)}
        {@const active = color === canvasManager.color}
        <button
          class="w-11 h-11 shrink-0 grid place-items-center rounded-xl active:scale-90 transition-all"
          onpointerdown={() => swatchDown(i)}
          onpointerup={swatchUp}
          onpointerleave={swatchUp}
          onclick={() => swatchClick(i, color)}
          aria-label="Colour {color}{active ? ', tap again to edit' : ''}"
          aria-pressed={active}
          title={active ? "Tap again to edit" : color}
        >
          <span
            class={[
              "rounded-full transition-all border border-content-1/30",
              active ? "w-7 h-7 ring-2 ring-primary ring-offset-2 ring-offset-base-1" : "w-6 h-6",
            ]}
            style="background-color: {color};"
          ></span>
        </button>
      {/each}
      <button
        class={btn}
        onclick={addColor}
        aria-label="Add colour"
        title="Add colour"
      >
        <IconPlus />
      </button>
    {/if}

    {#if def.size}
      {@const spec = def.size}
      {@render sep()}
      {#each spec.presets as v (v)}
        {@const active = canvasManager.size === v}
        <button
          class={btnOn(active)}
          onclick={() => setSize(v)}
          aria-label="{spec.label} {v}"
          aria-pressed={active}
          title="{spec.label}: {v}"
        >
          <span
            class="rounded-full bg-current"
            style="width: {dot(v)}px; height: {dot(v)}px;"
          ></span>
        </button>
      {/each}
      <button
        class={[
          "h-11 min-w-11 px-2 shrink-0 rounded-xl text-sm font-semibold tabular-nums transition-all active:scale-95",
          sizeOpen || !spec.presets.includes(canvasManager.size)
            ? "bg-primary text-base-1"
            : "hover:bg-overlay/30 text-content-2",
        ]}
        onclick={() => (sizeOpen = !sizeOpen)}
        aria-label="Custom {spec.label.toLowerCase()}"
        aria-expanded={sizeOpen}
        title="Custom {spec.label.toLowerCase()}"
      >
        {Math.round(canvasManager.size)}
      </button>
    {/if}
  </div>

  {#if sizeOpen && def.size}
    {@const spec = def.size}
    <div
      transition:fade={{ duration: 100 }}
      class="absolute right-0 top-full mt-2 p-3 w-64 rounded-xl bg-base-1 shadow-lg border border-content-1/10 flex flex-col gap-2"
    >
      <label class="flex flex-row justify-between text-sm text-content-2" for="tool-size">
        <span>{spec.label}</span>
        <span class="tabular-nums">{Math.round(canvasManager.size)}</span>
      </label>
      <input
        id="tool-size"
        type="range"
        class="w-full accent-[var(--primary)] h-8"
        min={spec.min}
        max={spec.max}
        step="1"
        value={canvasManager.size}
        oninput={(e) => setSize(+e.currentTarget.value)}
      />
    </div>
  {/if}
</div>

{#if editingIndex !== null}
  {@const idx = editingIndex}
  <ColorEditPopup
    bind:value={settingsStore.store.colors[idx]}
    canDelete={colors.length > 1}
    onClose={closeEditor}
    onDelete={deleteColor}
  />
{/if}


<script lang="ts">
  import {
    IconArrowBackUp,
    IconArrowForwardUp,
    IconGripHorizontal,
    IconGripVertical,
    IconPhotoPlus,
    IconScissors,
    IconScribbleOff,
    IconPlus,
  } from "@tabler/icons-svelte";
  import { fade } from "svelte/transition";
  import ColorEditPopup from "#lib/components/ColorEditPopup.svelte";
  import Slider from "#lib/components/Slider.svelte";
  import { settingsStore, updateSettings } from "#lib/state/settingsStore.svelte.ts";
  import { tabManager } from "#lib/state/tabManager.svelte.ts";
  import { canvasManager } from "./state/canvasManager.svelte";
  import { textEditor } from "./state/textEditor.svelte";
  import { TOOL_IDS, toolDef, type Tool } from "./tools/registry";
  import { formatSize } from "#lib/util/format.ts";
  import { insertImageFile, pickFiles } from "./import/image";
  import { isPdf, pdfImport } from "./import/pdfImport.svelte";
  import type { ToolbarDock } from "#lib/tauri/bindings.ts";

  /*
   * A horizontal bar at the top centre: away from the palm of a right-handed
   * writer, and with room for colour and size, which the old radial menu had
   * no space for.
   */

  const LONG_PRESS_MS = 450;

  // ---------------------------------------------------------------- docking
  //
  // The toolbar snaps to one edge of the editor (a setting). Drag the grip:
  // the bar follows the pointer, the nearest edge lights up, and on release
  // it docks there. Free placement was rejected on purpose: a floating bar
  // covers ink and gets lost on resize or rotation.

  const dock = $derived(settingsStore.store.toolbar_dock);
  const vertical = $derived(dock === "left" || dock === "right");

  const PLACEMENT: Record<ToolbarDock, string> = {
    top: "top-3 left-1/2 -translate-x-1/2 max-w-[calc(100%-1.5rem)]",
    // Above the page/zoom controls.
    bottom: "bottom-20 left-1/2 -translate-x-1/2 max-w-[calc(100%-1.5rem)]",
    // Clear of the zoom controls in the bottom-left corner.
    left: "left-3 top-1/2 -translate-y-1/2 max-h-[calc(100%-10rem)]",
    right: "right-3 top-1/2 -translate-y-1/2 max-h-[calc(100%-10rem)]",
  };
  const POPOVER: Record<ToolbarDock, string> = {
    top: "right-0 top-full mt-2",
    bottom: "right-0 bottom-full mb-2",
    left: "left-full ml-2 bottom-0",
    right: "right-full mr-2 bottom-0",
  };
  const ORDER: ToolbarDock[] = ["top", "right", "bottom", "left"];

  let root = $state<HTMLDivElement>();
  let moving = $state<{
    x: number;
    y: number;
    dx: number;
    dy: number;
    target: ToolbarDock;
    /** The editor area, captured at drag start: once the bar is `position:
     * fixed` its offsetParent is null and the area can't be looked up. */
    area: DOMRect;
  }>();

  function nearestEdge(x: number, y: number, r: DOMRect): ToolbarDock {
    const d: [ToolbarDock, number][] = [
      ["top", y - r.top],
      ["bottom", r.bottom - y],
      ["left", x - r.left],
      ["right", r.right - x],
    ];
    return d.reduce((a, b) => (b[1] < a[1] ? b : a))[0];
  }

  function gripDown(e: PointerEvent) {
    if (!root) return;
    e.preventDefault();
    (e.currentTarget as Element).setPointerCapture(e.pointerId);
    const area = root.offsetParent?.getBoundingClientRect();
    if (!area) return;
    const r = root.getBoundingClientRect();
    moving = { x: e.clientX, y: e.clientY, dx: e.clientX - r.left, dy: e.clientY - r.top, target: dock, area };
    sizeOpen = false;
  }

  function gripMove(e: PointerEvent) {
    if (!moving) return;
    moving.x = e.clientX;
    moving.y = e.clientY;
    moving.target = nearestEdge(e.clientX, e.clientY, moving.area);
  }

  function gripUp() {
    if (!moving) return;
    const { target } = moving;
    moving = undefined;
    if (target !== dock) updateSettings({ toolbar_dock: target });
  }

  /** Keyboard: Enter/Space on the grip moves the bar to the next edge. */
  function gripKey(e: KeyboardEvent) {
    if (e.key !== "Enter" && e.key !== " ") return;
    e.preventDefault();
    updateSettings({ toolbar_dock: ORDER[(ORDER.indexOf(dock) + 1) % ORDER.length] });
  }

  const btnBase =
    "w-11 h-11 shrink-0 grid place-items-center rounded-xl transition-all active:scale-90 disabled:opacity-30 disabled:pointer-events-none";
  const btnIdle = "text-content-2 hover:bg-overlay/30 hover:text-content-1";
  const btn = `${btnBase} ${btnIdle}`;
  const btnOn = (active: boolean) =>
    `${btnBase} ${active ? "bg-primary text-base-1" : btnIdle}`;

  const def = $derived(toolDef(canvasManager.tool));
  /** The active tool's swatches (pen/text share one set, highlighter has its own). */
  const palette = $derived(def.palette);
  const colors = $derived(palette ? (settingsStore.store[palette] ?? []) : []);
  const history = $derived(tabManager.tab?.history);

  /** Index of the swatch open in the edit popup, or null when closed. */
  let editingIndex = $state<number | null>(null);
  let sizeOpen = $state(false);

  function selectTool(t: Tool) {
    canvasManager.tool = t;
    sizeOpen = false;
    // The palette changes with the tool, so an open swatch editor would
    // point at the wrong list.
    if (editingIndex !== null) closeEditor();
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
    if (!palette) return;
    await updateSettings({ [palette]: $state.snapshot(settingsStore.store[palette]) });
  }

  function addColor() {
    if (!palette) return;
    settingsStore.store[palette].push(canvasManager.color || "#000000");
    editingIndex = settingsStore.store[palette].length - 1;
  }

  function closeEditor() {
    editingIndex = null;
    persistColors();
  }

  function deleteColor() {
    if (editingIndex === null || !palette) return;
    settingsStore.store[palette].splice(editingIndex, 1);
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
    const [file] = await pickFiles("image/*,application/pdf,.pdf");
    if (!file) return;
    // A PDF opens the page picker; an image goes straight in.
    if (isPdf(file)) await pdfImport.start(file);
    else await insertImageFile(file);
  }

  /** Dot size for a size preset, scaled into the 6–22 px range. */
  function dot(v: number) {
    const s = def.size!;
    return 6 + ((v - s.min) / (s.max - s.min)) * 16;
  }
</script>

{#snippet sep()}
  <div
    class={[
      "self-stretch bg-content-1/10 shrink-0",
      vertical ? "h-px mx-1" : "w-px my-1",
    ]}
  ></div>
{/snippet}

{#if moving}
  <!-- Drop targets: the edge the toolbar will dock to lights up. -->
  <div class="absolute inset-0 z-20 pointer-events-none" aria-hidden="true">
    {#each ORDER as edge (edge)}
      <div
        class={[
          "absolute rounded-full transition-all",
          edge === "top" && "top-1 left-1/4 right-1/4 h-1.5",
          edge === "bottom" && "bottom-1 left-1/4 right-1/4 h-1.5",
          edge === "left" && "left-1 top-1/4 bottom-1/4 w-1.5",
          edge === "right" && "right-1 top-1/4 bottom-1/4 w-1.5",
          moving.target === edge ? "bg-primary" : "bg-content-1/15",
        ]}
      ></div>
    {/each}
  </div>
{/if}

<!--
  mousedown is prevented so pressing a button never steals focus from an open
  text box (which would commit it before the colour/size change lands).
-->
<div
  bind:this={root}
  class={[
    "z-20 flex",
    vertical ? "flex-col" : "flex-row",
    moving ? "fixed opacity-90" : `absolute ${PLACEMENT[dock]}`,
  ]}
  style={moving ? `left: ${moving.x - moving.dx}px; top: ${moving.y - moving.dy}px;` : undefined}
  role="toolbar"
  aria-label="Editor tools"
  aria-orientation={vertical ? "vertical" : "horizontal"}
  tabindex="-1"
  onmousedown={(e) => {
    if (!(e.target instanceof HTMLInputElement)) e.preventDefault();
  }}
>
  <div
    class={[
      "flex items-center gap-1 p-1.5 rounded-2xl bg-base-1/80 backdrop-blur-md shadow-lg border border-content-1/10 hide-scrollbars",
      // min-h-0/min-w-0 let the bar shrink inside the wrapper's max size and
      // scroll instead of running into the zoom controls.
      vertical ? "flex-col overflow-y-auto min-h-0" : "flex-row overflow-x-auto min-w-0",
    ]}
  >
    <button
      class={[
        "shrink-0 grid place-items-center rounded-lg text-content-3 hover:text-content-1 hover:bg-overlay/30 touch-none",
        moving ? "cursor-grabbing" : "cursor-grab",
        vertical ? "w-11 h-6" : "w-6 h-11",
      ]}
      aria-label="Move toolbar (Enter moves it to the next edge)"
      title="Drag to dock the toolbar to another edge"
      onpointerdown={gripDown}
      onpointermove={gripMove}
      onpointerup={gripUp}
      onpointercancel={gripUp}
      onkeydown={gripKey}
    >
      {#if vertical}<IconGripHorizontal size={18} />{:else}<IconGripVertical size={18} />{/if}
    </button>
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
      aria-label="Insert image or PDF"
      title="Insert image or PDF"
    >
      <IconPhotoPlus />
    </button>

    {#if palette}
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

    {#if canvasManager.tool === "eraser"}
      {@render sep()}
      {#each [["partial", "Erase what you touch", IconScissors], ["stroke", "Erase whole strokes", IconScribbleOff]] as const as [mode, label, Icon] (mode)}
        {@const active = canvasManager.eraserMode === mode}
        <button
          class={btnOn(active)}
          onclick={() => (canvasManager.eraserMode = mode)}
          aria-label={label}
          aria-pressed={active}
          title={label}
        >
          <Icon />
        </button>
      {/each}
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
        {formatSize(canvasManager.size)}
      </button>
    {/if}
  </div>

  {#if sizeOpen && def.size}
    {@const spec = def.size}
    <div
      transition:fade={{ duration: 100 }}
      class="absolute {POPOVER[dock]} p-3 w-64 rounded-xl bg-base-1/85 backdrop-blur-md shadow-lg border border-content-1/10 flex flex-col gap-2"
    >
      <div class="flex flex-row justify-between text-sm text-content-2">
        <span>{spec.label}</span>
        <span class="tabular-nums">{formatSize(canvasManager.size)}</span>
      </div>
      <Slider
        label={spec.label}
        min={spec.min}
        max={spec.max}
        step={spec.step ?? 1}
        value={canvasManager.size}
        onchange={setSize}
      />
    </div>
  {/if}
</div>

{#if editingIndex !== null && palette}
  {@const idx = editingIndex}
  <ColorEditPopup
    bind:value={settingsStore.store[palette][idx]}
    canDelete={colors.length > 1}
    onClose={closeEditor}
    onDelete={deleteColor}
  />
{/if}


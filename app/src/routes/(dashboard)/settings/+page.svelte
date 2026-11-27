<script lang="ts">
  import Switch from "#lib/components/Switch.svelte";
  import { settingsStore, updateSettings } from "#lib/state/settingsStore.svelte.ts";
  import { titleBar } from "#lib/state/titleBar.svelte.ts";
  import { PRESSURE_THINNING, pressurePreview } from "#lib/editor/pressure.ts";
  import { inputToPath } from "#lib/editor/svg.ts";
  import type { BarrelButton, PenPressure } from "#lib/tauri/bindings.ts";

  const PRESSURE_OPTIONS: { id: PenPressure; label: string }[] = [
    { id: "off", label: "Off" },
    { id: "light", label: "Light" },
    { id: "strong", label: "Strong" },
  ];
  const BARREL_OPTIONS: { id: BarrelButton; label: string; hint: string }[] = [
    { id: "lasso", label: "Lasso", hint: "Switches to the lasso, which stays until nothing is selected." },
    { id: "eraser", label: "Eraser while held", hint: "Erases while you hold it; lifting the pen brings your tool back." },
    {
      id: "highlighter",
      label: "Highlighter while held",
      hint: "Highlights with the highlighter's colour and width while you hold it.",
    },
  ];
  const PREVIEW_W = 240;
  const PREVIEW_H = 48;
  const previewPoints = pressurePreview(PREVIEW_W, PREVIEW_H);
  import {
    IconAppWindow,
    IconDeviceFloppy,
    IconInfoCircle,
    IconPencil,
    IconPresentation,
  } from "@tabler/icons-svelte";
</script>

<div class="gap-8 flex-col flex">
  <div class="flex flex-col gap-4 p-4 rounded-xl bg-base-2">
    <h3 class="text-xl flex flex-row gap-2 items-center font-semibold">
      <IconPencil /> Editor Settings
    </h3>
    <div class="flex gap-4 flex-col">
      <Switch
        id="stylus-tool-switch"
        label="Stylus tool switching"
        description="The eraser end of your stylus erases while it touches the page, and the side button does what you choose below. The tip always uses the tool chosen in the toolbar. Turn this off if your stylus has no such buttons, or if it switches unintentionally."
        checked={!settingsStore.store.disable_tool_switch}
        onChange={(v) => updateSettings({ disable_tool_switch: !v })}
      />
      <div
        class={[
          "flex flex-col gap-2 pl-14 transition-opacity",
          settingsStore.store.disable_tool_switch && "opacity-40 pointer-events-none",
        ]}
      >
        <span class="text-sm text-content-2">Side button</span>
        <div class="flex flex-row flex-wrap gap-1 p-1 rounded-xl bg-base-3 w-fit" role="radiogroup" aria-label="Side button">
          {#each BARREL_OPTIONS as o (o.id)}
            {@const active = settingsStore.store.barrel_button === o.id}
            <button
              class={[
                "px-4 h-10 rounded-lg font-semibold transition-all active:scale-95",
                active ? "bg-primary text-base-1" : "text-content-2 hover:bg-overlay/30 hover:text-content-1",
              ]}
              role="radio"
              aria-checked={active}
              title={o.hint}
              onclick={() => updateSettings({ barrel_button: o.id })}
            >
              {o.label}
            </button>
          {/each}
        </div>
        <span class="text-sm text-content-3">
          {BARREL_OPTIONS.find((o) => o.id === settingsStore.store.barrel_button)?.hint}
        </span>
      </div>
      <Switch
        id="shift-swaps-scroll-axes"
        label="Shift swaps scroll axes"
        description="Hold Shift while scrolling to move the canvas sideways instead of up and down, and vice versa. Turn this off if your system already swaps the axes itself — otherwise the two cancel each other out."
        checked={settingsStore.store.shift_swaps_scroll_axes}
        onChange={(v) => updateSettings({ shift_swaps_scroll_axes: v })}
      />
      <Switch
        id="use-last-page-settings"
        label="New pages copy the current page"
        description="A new page gets the size, paper and colour of the page you are on. Turn this off to always start from a blank A4 page."
        checked={settingsStore.store.use_last_page_settings}
        onChange={(v) => updateSettings({ use_last_page_settings: v })}
      />
      <Switch
        id="transform-anywhere"
        label="Move selections from anywhere"
        description="With something selected, drag anywhere on the page to move it, and use two fingers to scale and rotate it instead of the view. A tap outside the selection still deselects. Text and images stay upright when rotated."
        checked={settingsStore.store.transform_anywhere}
        onChange={(v) => updateSettings({ transform_anywhere: v })}
      />
      <Switch
        id="shape-snap"
        label="Hold to draw shapes"
        description="Draw a line, rectangle, triangle, circle or ellipse and keep the pen still at the end: it turns into a clean shape. A line's end then follows the pen until you lift it. Small strokes, like handwriting, never change."
        checked={settingsStore.store.shape_snap}
        onChange={(v) => updateSettings({ shape_snap: v })}
      />
      <Switch
        id="dark-pages"
        label="Dark pages"
        description="Shows light pages dark while you work, e.g. in a dim lecture hall: white paper turns dark grey, imported PDF pages are inverted, and dark ink is shown light. Your notes keep their colours: exports, thumbnails and the presenter view are unchanged. Ink that is hard to read on dark paper is always shown lighter."
        checked={settingsStore.store.dark_pages}
        onChange={(v) => updateSettings({ dark_pages: v })}
      />
      <div class="flex flex-col gap-2">
        <div class="flex flex-col">
          <span class="font-semibold">Pen pressure</span>
          <span class="text-sm text-content-2">
            How much pressing harder widens the pen's line. Applies to new strokes; what you have
            written keeps its look. The highlighter always draws an even line.
          </span>
        </div>
        <div class="flex flex-row flex-wrap items-center gap-3">
          <div class="flex flex-row gap-1 p-1 rounded-xl bg-base-3" role="radiogroup" aria-label="Pen pressure">
            {#each PRESSURE_OPTIONS as o (o.id)}
              {@const active = settingsStore.store.pen_pressure === o.id}
              <button
                class={[
                  "px-4 h-10 rounded-lg font-semibold transition-all active:scale-95",
                  active ? "bg-primary text-base-1" : "text-content-2 hover:bg-overlay/30 hover:text-content-1",
                ]}
                role="radio"
                aria-checked={active}
                onclick={() => updateSettings({ pen_pressure: o.id })}
              >
                {o.label}
              </button>
            {/each}
          </div>
          <svg
            viewBox="0 0 {PREVIEW_W} {PREVIEW_H}"
            class="h-12 w-60 rounded-lg bg-content-1 text-base-3"
            aria-label="Preview: a line drawn light, then firm, then light"
            role="img"
          >
            <path
              d={inputToPath(previewPoints, 6, false, PRESSURE_THINNING[settingsStore.store.pen_pressure])}
              fill="currentColor"
            />
          </svg>
        </div>
      </div>
    </div>
  </div>

  <div class="flex flex-col gap-4 p-4 rounded-xl bg-base-2">
    <h3 class="text-xl flex flex-row gap-2 items-center font-semibold">
      <IconDeviceFloppy /> Saving
    </h3>
    <div class="flex gap-4 flex-col">
      <Switch
        id="autosave"
        label="Save automatically"
        description="Saves open notes a moment after you stop writing. New notes are saved into your notebooks folder. Turn this off to save only with Ctrl+S or the save button on the tab."
        checked={settingsStore.store.autosave}
        onChange={(v) => updateSettings({ autosave: v })}
      />
    </div>
  </div>

  <div class="flex flex-col gap-4 p-4 rounded-xl bg-base-2">
    <h3 class="text-xl flex flex-row gap-2 items-center font-semibold">
      <IconAppWindow /> Window
    </h3>
    <div class="flex gap-4 flex-col">
      <Switch
        id="system-title-bar"
        label="Use the system title bar"
        description="Show your operating system's title bar above the tabs instead of putting the window buttons into the tab bar. Useful with tiling window managers, or if moving and resizing the window misbehaves."
        checked={settingsStore.store.system_title_bar}
        onChange={(v) => updateSettings({ system_title_bar: v })}
      />
      {#if titleBar.needsRestart}
        <p class="flex flex-row gap-2 items-center text-sm text-content-2 rounded-lg bg-primary/10 border border-primary/30 px-3 py-2">
          <IconInfoCircle size={18} class="shrink-0 text-primary" />
          Restart RedNotes Plus to apply this. On Linux the title bar can only be chosen when the window opens.
        </p>
      {/if}
    </div>
  </div>

  <div class="flex flex-col gap-4 p-4 rounded-xl bg-base-2">
    <h3 class="text-xl flex flex-row gap-2 items-center font-semibold">
      <IconPresentation /> Presenting
    </h3>
    <div class="flex gap-4 flex-col">
      <Switch
        id="present-fullscreen"
        label="Full screen on a second display"
        description="Presenter mode (F5) fills your second display. Turn this off to open it as a maximized window there instead, e.g. to keep the taskbar. Without a second display it always opens as a window behind the editor."
        checked={settingsStore.store.present_fullscreen}
        onChange={(v) => updateSettings({ present_fullscreen: v })}
      />
    </div>
  </div>

  <p class="text-content-2 text-center">More settings will follow shortly!</p>
</div>

<script lang="ts">
  import Switch from "#lib/components/Switch.svelte";
  import { settingsStore, updateSettings } from "#lib/state/settingsStore.svelte.ts";
  import { IconAppWindow, IconDeviceFloppy, IconPencil } from "@tabler/icons-svelte";
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
        description="The eraser end of your stylus erases while it touches the page, and the side button picks the lasso until nothing is selected. The tip always uses the tool chosen in the toolbar. Turn this off if your stylus has no such buttons, or if it switches unintentionally."
        checked={!settingsStore.store.disable_tool_switch}
        onChange={(v) => updateSettings({ disable_tool_switch: !v })}
      />
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
    </div>
  </div>

  <p class="text-content-2 text-center">More settings will follow shortly!</p>
</div>

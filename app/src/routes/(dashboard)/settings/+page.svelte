<script>
  import Switch from "$lib/components/Switch.svelte";
  import { settingsStore } from "$lib/state/settingsStore.svelte";
  import { commands } from "$lib/tauri/bindings";
  import { IconPencil } from "@tabler/icons-svelte";
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
        description="Lets your stylus change the active tool with its eraser tip or side buttons. Turn this off if your stylus has no such buttons, or if it keeps switching tools unintentionally."
        checked={!settingsStore.store.disable_tool_switch}
        onChange={async (v) => {
          await commands.setToolSwitch(!v);
        }}
      />
      <Switch
        id="shift-swaps-scroll-axes"
        label="Shift swaps scroll axes"
        description="Hold Shift while scrolling to move the canvas sideways instead of up and down, and vice versa. Turn this off if your system already swaps the axes itself — otherwise the two cancel each other out."
        checked={settingsStore.store.shift_swaps_scroll_axes}
        onChange={async (v) => {
          await commands.setShiftSwapsScrollAxes(v);
        }}
      />
    </div>
  </div>

  <p class="text-content-2 text-center">More settings will follow shortly!</p>
</div>

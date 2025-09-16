<script lang="ts">
  import { penDefaults } from "$lib/canvas/BlockManager.svelte";
  import Canvas from "$lib/components/Canvas.svelte";
  import Toolbar from "$lib/components/Toolbar.svelte";
  import type { ToolSettings } from "$lib/types/canvas";
  import { invoke } from "@tauri-apps/api/core";
  import { save } from "@tauri-apps/plugin-dialog";
  import { tabManager } from "$lib/tabs/tabs.svelte";
  import { goto } from "$app/navigation";
  import NoteSettings from "$lib/components/NoteSettings.svelte";

  let tool: ToolSettings = $state(penDefaults);
  let settingsOpen = $state(false);

  const currentTab = $derived(tabManager.currentTab);
  const data = $derived(tabManager.currentPage);
  const pageManager = $derived(data.page);
  const canvasManager = $derived(data.canvas);

  $effect(() => {
    if (!data) goto("/");
  });

  function updateTool(newTool: ToolSettings) {
    tool = newTool;
  }

  const hotkeys = async (e: KeyboardEvent) => {
    if (!e.ctrlKey) return;
    if (e.key === "s" && currentTab.path) {
      // TODO: Save to user directory
      await invoke("write", {
        path: currentTab.path,
        note: JSON.stringify(pageManager.export(canvasManager.export()!)),
      });
    } else if (
      e.key === "S" ||
      (e.key === "s" && e.shiftKey) ||
      (e.key === "s" && currentTab.path === null)
    ) {
      // Open file save dialog

      const path = await save({
        filters: [{ name: "RedNotes Plus File", extensions: ["rnpf"] }],
        title: "Save RedNotes Plus File",
      });

      if (!path) return;

      currentTab.path = path;

      await invoke("write", {
        path,
        note: JSON.stringify(pageManager.export(canvasManager.export()!)),
      });
    }
  };
  document.addEventListener("keydown", hotkeys);

  $effect(() => {
    return () => {
      document.removeEventListener("keydown", hotkeys);
    };
  });

  function openSettings() {
    settingsOpen = true;
  }
  function closeSettings() {
    settingsOpen = false;
  }
</script>

<div class="w-full h-screen relative touch-none">
  <NoteSettings
    data={{
      page: pageManager,
    }}
    closeCb={closeSettings}
    visible={settingsOpen}
  />
  <Toolbar {tool} {updateTool} {openSettings} />
  <Canvas {tool} {pageManager} {canvasManager} />
</div>

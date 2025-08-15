<script lang="ts">
  import { penDefaults } from "$lib/canvas/BlockManager.svelte";
  import { CanvasManager } from "$lib/canvas/CanvasManager.svelte";
  import { PageManager } from "$lib/canvas/PageManager.svelte";
  import Canvas from "$lib/components/Canvas.svelte";
  import Toolbar from "$lib/components/Toolbar.svelte";
  import type { ToolSettings } from "$lib/types/canvas";
  import { invoke } from "@tauri-apps/api/core";
  import type { PageData } from "./$types";
  import type { FileMeta } from "$lib/types/bindings/FileMeta";
  import { save } from "@tauri-apps/plugin-dialog";

  let tool: ToolSettings = $state(penDefaults);
  const { data }: { data: PageData } = $props();
  const { file } = data;

  let pageManager = $state(new PageManager());
  let canvasManager = $state(new CanvasManager());

  if (file) {
    // svelte-ignore state_referenced_locally
    pageManager.import(file.note, canvasManager);
  }

  function updateTool(newTool: ToolSettings) {
    tool = newTool;
  }

  const hotkeys = async (e: KeyboardEvent) => {
    if (!e.ctrlKey) return;
    if (e.key === "s") {
      // TODO: Save to user directory
    } else if ((e.key === "S" || e.key === "s") && e.shiftKey) {
      // Open file save dialog

      const path = await save({
        filters: [{ name: "RedNotes Plus File", extensions: ["rnpf"] }],
        title: "Save RedNotes Plus File",
      });

      if (!path) return;

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
</script>

<div class="w-full h-screen relative">
  <Toolbar {tool} {updateTool} />
  <Canvas {tool} {pageManager} {canvasManager} />
</div>

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
</script>

<div class="w-full h-screen relative">
  <Toolbar {tool} {updateTool} />
  <Canvas {tool} {pageManager} {canvasManager} />
</div>

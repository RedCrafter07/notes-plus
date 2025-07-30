<script lang="ts">
  import { penDefaults } from "$lib/canvas/BlockManager.svelte";
  import Canvas from "$lib/components/Canvas.svelte";
  import Toolbar from "$lib/components/Toolbar.svelte";
  import type { ToolSettings } from "$lib/types/canvas";
  import type { PageData } from "./$types";

  let tool: ToolSettings = $state(penDefaults);
  let { data }: { data: PageData } = $props();

  function updateTool(newTool: ToolSettings) {
    tool = newTool;
  }
</script>

<Canvas {tool} />
<Toolbar {tool} {updateTool} />

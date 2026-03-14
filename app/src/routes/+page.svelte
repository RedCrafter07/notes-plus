<script lang="ts">
  import { commands } from "$lib/tauri/bindings";
  import { IconClock } from "@tabler/icons-svelte";

  let recentNotes = $state<any[]>([]);

  $effect(() => {
    (async () => {
      recentNotes = await commands.getRecent();
    })();
  });
</script>

<div class="w-full min-h-screen bg-base-1">
  <div class="p-2 container mx-auto flex flex-col gap-12">
    <h1 class="text-3xl font-display font-bold tracking-wider">
      Welcome to RedNotes Plus!
    </h1>

    <div class="flex flex-col gap-4">
      <h3 class="text-xl flex flex-row gap-2 items-center">
        <IconClock /> Recent files
      </h3>
      <p></p>
    </div>
  </div>
</div>

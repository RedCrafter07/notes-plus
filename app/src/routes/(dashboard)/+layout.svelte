<script lang="ts">
  import { goto } from "$app/navigation";
  import { resolve } from "$app/paths";
  import { newNote } from "$lib/util/notes";
  import { IconHome, IconPlus, IconSettings } from "@tabler/icons-svelte";

  let { children } = $props();
</script>

<div class="flex flex-row w-full min-h-screen bg-base-1">
  <div class="bg-base-2 flex flex-col gap-8 p-4">
    <div>
      <h3 class="font-display text-2xl font-black">RedNotes Plus</h3>
    </div>
    <div class="flex flex-col gap-4">
      <button
        class="flex flex-row gap-2 items-center"
        onclick={() => {
          goto(resolve("/"));
        }}
      >
        <IconHome />
        <p>Home</p>
      </button>
      <button
        class="flex flex-row gap-2 items-center"
        onclick={async () => {
          await newNote();
        }}
      >
        <IconPlus />
        <p>New Note</p>
      </button>
      <button
        class="flex flex-row gap-2 items-center"
        onclick={() => {
          goto(resolve("/settings"));
        }}
      >
        <IconSettings />
        <p>Settings</p>
      </button>
    </div>
  </div>
  <div class="flex-1 p-2">
    {@render children()}
  </div>
</div>

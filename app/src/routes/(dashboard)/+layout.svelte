<script lang="ts">
  import { goto } from "$app/navigation";
  import { resolve } from "$app/paths";
  import { settingsStore } from "$lib/state/settingsStore.svelte";
  import { tabManager } from "$lib/state/tabManager.svelte";
  import { commands } from "$lib/tauri/bindings";
  import { newNote } from "$lib/util/notes.svelte";
  import {
    IconFolder,
    IconHome,
    IconPlus,
    IconSettings,
  } from "@tabler/icons-svelte";
  import logo from "$lib/components/notes_static.svg?raw";

  let { children } = $props();
</script>

<div class="flex flex-row w-full h-full bg-base-1">
  <div class="bg-base-2 flex flex-col gap-8 p-4">
    <div class="h-10">
      {#key settingsStore.store.sidebar_collapsed}
        <div
          class={[
            "font-display text-2xl font-black",
            { "h-6 aspect-square": settingsStore.store.sidebar_collapsed },
          ]}
        >
          {#if settingsStore.store.sidebar_collapsed}
            {@html logo}
          {:else}
            RedNotes Plus
          {/if}
        </div>
      {/key}
    </div>
    <div class="flex flex-col gap-4 h-full">
      <button
        class="flex flex-row gap-2 items-center"
        onclick={() => {
          goto(resolve("/"));
        }}
      >
        <IconHome />
        {#if !settingsStore.store.sidebar_collapsed}
          <p>Home</p>
        {/if}
      </button>
      <button
        class="flex flex-row gap-2 items-center"
        onclick={async () => {
          await newNote();
        }}
      >
        <IconPlus />
        {#if !settingsStore.store.sidebar_collapsed}
          <p>New Notebook</p>
        {/if}
      </button>
      <button
        class="flex flex-row gap-2 items-center"
        onclick={async () => {
          const data = await commands.openNotesDialog();

          data.forEach(({ note_data: d, path }, i, a) => {
            tabManager.add(d, i === a.length - 1, path);
            if (i === a.length - 1) goto(resolve("/edit/[id]", { id: d.id }));
          });
        }}
      >
        <IconFolder />
        {#if !settingsStore.store.sidebar_collapsed}
          <p>Open files</p>
        {/if}
      </button>
      <button
        class="flex flex-row gap-2 items-center mt-auto"
        onclick={() => {
          goto(resolve("/settings"));
        }}
      >
        <IconSettings />
        {#if !settingsStore.store.sidebar_collapsed}
          <p>Settings</p>
        {/if}
      </button>
    </div>
  </div>
  <!-- svelte-ignore a11y_consider_explicit_label -->
  <button
    tabindex="-1"
    class="h-full w-1 hover:bg-overlay/50 transition-all"
    onclick={async () => {
      await commands.collapseSidebar(!settingsStore.store.sidebar_collapsed);
    }}
  ></button>
  <div class="flex-1 p-4 overflow-y-auto h-full">
    {@render children()}
  </div>
</div>

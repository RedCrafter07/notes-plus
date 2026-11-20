<script lang="ts">
  import { goto } from "$app/navigation";
  import { resolve } from "$app/paths";
  import { settingsStore, updateSettings } from "#lib/state/settingsStore.svelte.ts";
  import { commands } from "#lib/tauri/bindings.ts";
  import { loadNotebooks, problemsStore } from "#lib/state/fsStore.svelte.ts";
  import { onMount } from "svelte";
  import { newNote, openNotes } from "#lib/util/notes.svelte.ts";
  import {
    IconAlertTriangle,
    IconFolder,
    IconHome,
    IconLayoutSidebarLeftCollapse,
    IconLayoutSidebarLeftExpand,
    IconPlus,
    IconSettings,
  } from "@tabler/icons-svelte";
  import logo from "#lib/components/notes_static.svg?raw";

  let { children } = $props();

  // Index once for every dashboard page, so the Problems badge shows anywhere.
  onMount(() => {
    loadNotebooks();
  });
</script>

<div class="flex flex-row w-full h-full bg-base-1">
  <div class="bg-base-2 flex flex-col gap-8 p-4">
    <div class="h-10">
      {#key settingsStore.store.sidebar_collapsed}
        <div
          class={[
            "font-display text-2xl font-black",
            { "w-6 h-6": settingsStore.store.sidebar_collapsed },
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
          goto(resolve("/(dashboard)"));
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
          openNotes(data);
        }}
      >
        <IconFolder />
        {#if !settingsStore.store.sidebar_collapsed}
          <p>Open files</p>
        {/if}
      </button>
      {#if problemsStore.store.length > 0}
        <!-- Only shown when something is wrong, so it draws the eye. -->
        <button
          class="relative flex flex-row gap-2 items-center text-destructive"
          onclick={() => goto(resolve("/(dashboard)/problems"))}
          title="Files that can't be opened"
        >
          <IconAlertTriangle />
          {#if settingsStore.store.sidebar_collapsed}
            <span
              class="absolute -top-2 -right-2 min-w-5 h-5 px-1 rounded-full bg-destructive text-destructive-content text-xs font-bold grid place-items-center"
            >
              {problemsStore.store.length}
            </span>
          {:else}
            <p>Problems</p>
            <span
              class="min-w-6 h-6 px-1.5 rounded-full bg-destructive text-destructive-content text-xs font-bold grid place-items-center"
            >
              {problemsStore.store.length}
            </span>
          {/if}
        </button>
      {/if}
      <button
        class="flex flex-row gap-2 items-center mt-auto"
        onclick={() => {
          goto(resolve("/(dashboard)/settings"));
        }}
      >
        <IconSettings />
        {#if !settingsStore.store.sidebar_collapsed}
          <p>Settings</p>
        {/if}
      </button>
      <button
        class="flex flex-row gap-2 items-center text-content-3 hover:text-content-1 transition-all"
        onclick={() =>
          updateSettings({ sidebar_collapsed: !settingsStore.store.sidebar_collapsed })}
        aria-label={settingsStore.store.sidebar_collapsed ? "Expand sidebar" : "Collapse sidebar"}
      >
        {#if settingsStore.store.sidebar_collapsed}
          <IconLayoutSidebarLeftExpand />
        {:else}
          <IconLayoutSidebarLeftCollapse />
          <p>Collapse</p>
        {/if}
      </button>
    </div>
  </div>
  <div class="flex-1 p-4 overflow-y-auto h-full">
    {@render children()}
  </div>
</div>

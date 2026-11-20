<script lang="ts">
  import { fsStore } from "#lib/state/fsStore.svelte.ts";
  import { IconArrowUp, IconFolder } from "@tabler/icons-svelte";
  import NoteCard from "./NoteCard.svelte";
  import FolderPicker from "./FolderPicker.svelte";
  import { commands } from "#lib/tauri/bindings.ts";
  import { openNotes } from "#lib/util/notes.svelte.ts";

  const fs = $derived(fsStore.store);
  let selection = $state("");

  function pathExists(input: string): boolean {
    return fs.allFolders.includes(input);
  }

  async function openFile(path: string) {
    const notes = await commands.openNotes([path]);
    openNotes(notes);
  }
</script>

<div class="flex flex-col gap-2">
  <div class="flex flex-row gap-2">
    <button
      class="aspect-square p-2 rounded-xl bg-base-3 border-2 border-content-1/10 text-content-3 hover:text-content-1 hover:border-content-1/30 transition-all active:scale-95"
      onclick={() => {
        fs.goBack();
        selection = fs.path;
      }}
    >
      <IconArrowUp />
    </button>
    <div class="flex-1">
      <FolderPicker
        id="file-browser-picker"
        type="browse"
        bind:value={selection}
        submitCb={() => {
          if (pathExists(selection)) fs.enterPath(selection);
        }}
      />
    </div>
  </div>

  <div class="grid grid-cols-[repeat(auto-fill,minmax(9rem,1fr))] gap-3">
    {#each fs.folders as folder (folder.name)}
      <button
        class="p-2 bg-base-3 rounded-xl flex flex-col gap-2 text-content-2 hover:text-content-1 hover:bg-overlay/30 transition-all active:scale-95 text-left min-w-0"
        onclick={() => {
          fs.enterFolder(folder.name);
          selection = fs.path;
        }}
      >
        <div class="w-full aspect-[3/4] rounded-lg bg-base-1 grid place-items-center">
          <IconFolder size={36} />
        </div>
        <span class="font-semibold truncate px-1">{folder.name}</span>
      </button>
    {/each}
    {#each fs.files as file (file.path)}
      <NoteCard {file} onclick={() => openFile(file.path)} />
    {/each}
  </div>
</div>

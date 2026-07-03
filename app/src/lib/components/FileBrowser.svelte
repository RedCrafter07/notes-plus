<script lang="ts">
  import { fsStore } from "$lib/state/fsStore.svelte";
  import { IconArrowUp, IconFile, IconFolder } from "@tabler/icons-svelte";
  import FolderPicker from "./FolderPicker.svelte";
  import { commands } from "$lib/tauri/bindings";
  import { openNotes } from "$lib/util/notes.svelte";

  const allFolders = $state(fsStore.store.allFolders);
  const fs = $derived(fsStore.store);
  let selection = $state("");

  function pathExists(input: string): boolean {
    return allFolders.includes(input);
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

  <div class="grid grid-cols-5 gap-4">
    {#each fs.folders as folder}
      <button
        class="p-2 bg-base-3 rounded-xl flex flex-col gap-2 items-center justify-around text-content-3 hover:text-content-1 transition-all active:scale-95"
        onclick={() => {
          fs.enterFolder(folder.name);
          selection = fs.path;
        }}
      >
        <div class="flex-1">
          <IconFolder />
        </div>
        <div>{folder.name}</div>
      </button>
    {/each}
    {#each fs.files as file}
      <button
        class="p-2 bg-base-3 rounded-xl flex flex-col gap-2 items-center justify-around text-content-3 hover:text-content-1 transition-all active:scale-95"
        onclick={async () => {
          openFile(file.path);
        }}
      >
        <div class="flex-1">
          <IconFile />
        </div>
        <div>{file.title}</div>
      </button>
    {/each}
  </div>
</div>

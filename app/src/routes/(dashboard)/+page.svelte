<script lang="ts">
  import FileBrowser from "#lib/components/FileBrowser.svelte";
  import NoteCard from "#lib/components/NoteCard.svelte";
  import { fsStore } from "#lib/state/fsStore.svelte.ts";
  import { jotStore } from "#lib/state/jotStore.svelte.ts";
  import { commands, type File } from "#lib/tauri/bindings.ts";
  import { FileSystemNavigator, isFolder } from "#lib/util/fileSystem.svelte.ts";
  import { openNotes } from "#lib/util/notes.svelte.ts";
  import { overlayManager } from "#lib/state/overlayManager.svelte.ts";
  import {
    IconClock,
    IconFolder,
    IconPencil,
    IconPlus,
  } from "@tabler/icons-svelte";

  let recentNotes = $state<File[]>([]);

  async function openRecent(path: string) {
    openNotes(await commands.openNotes([path]));
  }
  let jotNoteInputs = $state<HTMLInputElement[]>([]);

  $effect(() => {
    (async () => {
      jotStore.store = await commands.listJotNotes();
      recentNotes = await commands.getRecent(6);

      const notebooks = await commands.getNotebooks();
      if (notebooks && isFolder(notebooks))
        fsStore.store = new FileSystemNavigator(notebooks);
    })();

    return () => {
      (async () => {
        await jotStore.save();
      })();
    };
  });
</script>

<div class="container mx-auto flex flex-col gap-4 h-full">
  <div class="flex flex-col gap-4 p-4 rounded-xl bg-base-2">
    <h3 class="text-xl flex flex-row gap-2 items-center font-semibold">
      <IconClock /> Recent files
    </h3>
    {#if recentNotes.length > 0}
      <div class="grid grid-cols-[repeat(auto-fill,minmax(9rem,1fr))] gap-3">
        {#each recentNotes as note (note.path)}
          <NoteCard file={note} onclick={() => openRecent(note.path)} />
        {/each}
      </div>
    {:else}
      <p class="text-content-2">
        No recent files found. Why don't you create one?
      </p>
    {/if}
  </div>

  <div class="flex flex-col gap-4 bg-base-2 p-4 rounded-xl">
    <div class="flex flex-row items-center gap-2">
      <h3 class="flex flex-row gap-2 items-center font-semibold text-xl flex-1">
        <IconPencil />
        Jot Notes
      </h3>
      <button
        class="flex flex-row gap-1 items-center px-3 h-10 rounded-xl bg-base-1 hover:bg-overlay/30 active:scale-95 transition-all"
        onclick={() => overlayManager.setOpen("jotDown")}
      >
        <IconPlus size={18} /> Jot down
      </button>
    </div>
    {#if jotStore.store.length > 0}
      <div
        class="flex flex-col gap-2"
        onfocusout={async (e) => {
          if (!e.currentTarget.contains(e.relatedTarget as Node | null)) {
            await jotStore.save();
          }
        }}
      >
        {#each jotStore.store as _, i (`jotnote${i}`)}
          <div class="flex flex-row items-center">
            <input
              bind:this={jotNoteInputs[i]}
              bind:value={jotStore.store[i]}
              class="focus:outline-none flex-1"
              onkeydown={async (e) => {
                if (e.key === "Enter") {
                  jotStore.store.push("");
                  setTimeout(() => {
                    jotNoteInputs[i + 1].focus();
                  }, 0);
                } else if (
                  e.key === "Backspace" &&
                  e.currentTarget.value.length === 0
                ) {
                  e.preventDefault();
                  jotStore.store.splice(i, 1);
                  if (i !== 0) jotNoteInputs[i - 1].focus();
                  else jotNoteInputs[i + 1]?.focus();
                }
              }}
            />
          </div>
        {/each}
      </div>
    {/if}
    <p class="opacity-50 text-sm">
      Quick thoughts that don't belong in a notebook yet. Press Ctrl+J anywhere
      to add one.
    </p>
  </div>

  <div class="flex flex-col gap-4 p-4 rounded-xl bg-base-2">
    <h3 class="text-xl flex flex-row gap-2 items-center font-semibold">
      <IconFolder /> Browse files
    </h3>
    <FileBrowser />
  </div>
</div>

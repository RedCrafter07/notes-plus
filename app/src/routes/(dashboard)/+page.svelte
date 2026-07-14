<script lang="ts">
  import FileBrowser from "$lib/components/FileBrowser.svelte";
  import { fsStore } from "$lib/state/fsStore.svelte";
  import { jotStore } from "$lib/state/jotStore.svelte";
  import { commands, type NoteData } from "$lib/tauri/bindings";
  import { FileSystemNavigator, isFolder } from "$lib/util/fileSystem.svelte";
  import { IconClock, IconFolder, IconPencil } from "@tabler/icons-svelte";

  let recentNotes = $state<NoteData[]>([]);
  let jotNoteInputs = $state<HTMLInputElement[]>([]);

  $effect(() => {
    (async () => {
      jotStore.store = await commands.listJotNotes();
      recentNotes = await commands.getRecent();

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
  {#if jotStore.store.length > 0}
    <div class="flex flex-col gap-4 bg-base-2 p-4 rounded-xl">
      <h3 class="flex flex-row gap-2 items-center font-semibold text-xl">
        <IconPencil />
        Jot Notes
      </h3>
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
                  else jotNoteInputs[i + 1].focus();
                }
              }}
            />
          </div>
        {/each}
      </div>
      <p class="opacity-50 text-sm">Press Ctrl+J anywhere to add a new note</p>
    </div>
  {/if}

  <div class="flex flex-col gap-4 p-4 rounded-xl bg-base-2">
    <h3 class="text-xl flex flex-row gap-2 items-center font-semibold">
      <IconClock /> Recent files
    </h3>
    {#each recentNotes as note (`recent-${note.meta.id}`)}
      <div></div>
    {:else}
      <p class="text-content-2">
        No recent files found. Why don't you create one?
      </p>
    {/each}
  </div>
  <div class="flex flex-col gap-4 p-4 rounded-xl bg-base-2">
    <h3 class="text-xl flex flex-row gap-2 items-center font-semibold">
      <IconFolder /> Browse files
    </h3>
    <FileBrowser />
  </div>
</div>

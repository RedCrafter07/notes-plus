<script lang="ts">
  import { commands, events, type NoteData } from "$lib/tauri/bindings";
  import { IconClock, IconPencil } from "@tabler/icons-svelte";
  import type { UnlistenFn } from "@tauri-apps/api/event";
  import { getCurrentWindow } from "@tauri-apps/api/window";

  let jotNotes = $state<string[]>([]);
  let recentNotes = $state<NoteData[]>([]);
  let jotNoteInputs = $state<HTMLInputElement[]>([]);

  $effect(() => {
    events.jotDown.listen((e) => {
      jotNotes = e.payload;
    });

    let unlisten: UnlistenFn;

    (async () => {
      unlisten = await getCurrentWindow().onCloseRequested(async (e) => {
        e.preventDefault();
        jotNoteInputs.forEach((v) => v.blur());

        if (
          jotNoteInputs.length === 1 &&
          jotNoteInputs[0]?.value.trim().length === 0
        )
          await commands.removeJotNote(0);

        await commands.quit();
      });

      jotNotes = await commands.listJotNotes();
      recentNotes = await commands.getRecent();
    })();

    return () => {
      unlisten?.();
    };
  });
</script>

<div class="container mx-auto flex flex-col gap-4">
  {#if jotNotes.length > 0}
    <div class="flex flex-col gap-4 bg-base-2 p-4 rounded-xl">
      <h3 class="flex flex-row gap-2 items-center font-semibold text-xl">
        <IconPencil />
        Jot Notes
      </h3>
      <div class="flex flex-col gap-2">
        {#each jotNotes as note, i (`jotnote${i}`)}
          <div class="flex flex-row items-center">
            <input
              bind:this={jotNoteInputs[i]}
              class="focus:outline-none flex-1"
              value={note}
              onkeydown={async (e) => {
                if (e.key === "Enter") {
                  await commands.addJotNote("");
                  jotNoteInputs[i + 1].focus();
                } else if (
                  e.key === "Backspace" &&
                  e.currentTarget.value.length === 0
                ) {
                  e.preventDefault();
                  await commands.removeJotNote(i);
                  if (i !== 0) jotNoteInputs[i - 1].focus();
                  else jotNoteInputs[i + 1].focus();
                }
              }}
              onblur={async (e) => {
                await commands.editJotNote(i, e.currentTarget.value);
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
    {#each recentNotes as note (`recent-${note.id}`)}
      <div></div>
    {:else}
      <p class="text-content-2">
        No recent files found. Why don't you create one?
      </p>
    {/each}
  </div>
</div>

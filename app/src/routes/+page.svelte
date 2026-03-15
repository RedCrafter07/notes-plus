<script lang="ts">
  import { commands, events } from "$lib/tauri/bindings";
  import { IconClock } from "@tabler/icons-svelte";
  import type { UnlistenFn } from "@tauri-apps/api/event";
  import { getCurrentWindow } from "@tauri-apps/api/window";

  let jotNotes = $state<string[]>([]);
  let recentNotes = $state<any[]>([]);
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
        await commands.quit();
      });

      jotNotes = await commands.listNotes();
      recentNotes = await commands.getRecent();
    })();

    return () => {
      unlisten?.();
    };
  });
</script>

<div class="w-full min-h-screen bg-base-1">
  <div class="p-2 container mx-auto flex flex-col gap-8">
    <h1 class="text-3xl font-display font-bold tracking-wider">
      Welcome to RedNotes Plus!
    </h1>

    {#if jotNotes.length > 0}
      <div class="flex flex-col gap-4 bg-base-2 p-4 rounded-xl">
        <h3 class="text-xl font-display font-bold tracking-wide">Jot Notes</h3>
        <div class="flex flex-col gap-2">
          {#each jotNotes as note, i (`jotnote${i}`)}
            <div class="flex flex-row items-center">
              <input
                bind:this={jotNoteInputs[i]}
                class="focus:outline-none flex-1"
                value={note}
                onkeydown={async (e) => {
                  if (e.key === "Enter") {
                    await commands.addNote("");
                    jotNoteInputs[i + 1].focus();
                  } else if (
                    e.key === "Backspace" &&
                    e.currentTarget.value.length === 0
                  ) {
                    e.preventDefault();
                    commands.removeNote(i);
                    if (i !== 0) jotNoteInputs[i - 1].focus();
                    else jotNoteInputs[i + 1].focus();
                  }
                }}
                onblur={async (e) => {
                  await commands.editNote(i, e.currentTarget.value);
                }}
              />
            </div>
          {/each}
        </div>
      </div>
    {/if}

    <div class="flex flex-col gap-4">
      <h3 class="text-xl flex flex-row gap-2 items-center">
        <IconClock /> Recent files
      </h3>
      <p></p>
    </div>
  </div>
</div>

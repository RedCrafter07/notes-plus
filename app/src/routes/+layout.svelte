<script lang="ts">
  import { onMount } from "svelte";
  import "@fontsource-variable/funnel-display";
  import "@fontsource-variable/funnel-sans";
  import "../app.css";
  import "../mocha.css";
  import { commands, events, type NoteData } from "$lib/tauri/bindings";
  import { timeout } from "$lib/util/timeout";
  import { overlayManager } from "$lib/state/overlayManager.svelte";
  import Modals from "$lib/components/Modals.svelte";
  import { contentManager } from "$lib/state/contentManager.svelte";
  import { goto } from "$app/navigation";
  import { resolve } from "$app/paths";

  const { children } = $props();

  onMount(async () => {
    events.open.listen((e) => {
      openNote(e.payload);
    });

    await timeout(50);
    await commands.ready();
  });

  $effect(() => {
    const keydownEvent = async (e: KeyboardEvent) => {
      if (e.key == "Escape" && overlayManager.open !== undefined) {
        overlayManager.close();
        return;
      }

      if (!e.ctrlKey) return;
      if (e.key == "q") {
        await commands.quit();
      } else if (e.key == "j") {
        e.preventDefault();
        overlayManager.setOpen("jotDown");
      } else if (e.key == "o") {
        e.preventDefault();
        const data = await commands.openNotesDialog();

        if (data[0]) {
          const d = data[0];
          openNote(d);
        }
      }
    };
    const contextMenuEvent = (e: PointerEvent) => e.preventDefault();

    // We use capture: true to ensure it catches the event before anything else
    document.addEventListener("contextmenu", contextMenuEvent, {
      capture: true,
    });
    document.addEventListener("keydown", keydownEvent);

    return () => {
      document.removeEventListener("keydown", keydownEvent);
      document.removeEventListener("contextmenu", contextMenuEvent, {
        capture: true,
      });
    };
  });

  function openNote(data: NoteData) {
    goto(resolve("/edit/[id]", { id: data.id }));
    contentManager.import(data.content, data.state, {
      id: data.id,
      path: data.path,
    });
  }
</script>

<div class="min-h-screen bg-base-3 text-content-1">
  <Modals />
  {@render children()}
</div>

<script lang="ts">
  import { onMount } from "svelte";
  import "@fontsource-variable/funnel-display";
  import "@fontsource-variable/funnel-sans";
  import "../app.css";
  import "../mocha.css";
  import { commands, events, type OpenData } from "$lib/tauri/bindings";
  import { timeout } from "$lib/util/timeout";
  import { overlayManager } from "$lib/state/overlayManager.svelte";
  import Modals from "$lib/components/Modals.svelte";
  import Tabs from "$lib/components/Tabs.svelte";
  import { tabManager } from "$lib/state/tabManager.svelte";
  import { newNote, openNotes } from "$lib/util/notes.svelte";
  import Popups from "$lib/components/Popups.svelte";
  import { settingsStore } from "$lib/state/settingsStore.svelte";
  import { defaultsStore } from "$lib/state/defaultsStore.svelte";
  import type { UnlistenFn } from "@tauri-apps/api/event";
  import { getCurrentWindow } from "@tauri-apps/api/window";
  import { jotStore } from "$lib/state/jotStore.svelte";

  const { children } = $props();

  onMount(async () => {
    events.open.listen((e) => {
      openNote(e.payload);
    });

    events.settingsUpdate.listen((e) => {
      settingsStore.store = e.payload;
    });

    await timeout(50);
    await commands.ready();
    settingsStore.store = await commands.getSettings();
    defaultsStore.store = await commands.getDefaults();
  });

  $effect(() => {
    const keydownEvent = async (e: KeyboardEvent) => {
      if (e.key == "Escape" && overlayManager.open !== undefined) {
        overlayManager.close();
        return;
      }

      if (!e.ctrlKey) return;
      if (e.key === "q") {
        await quit();
      } else if (e.key === "j") {
        e.preventDefault();
        overlayManager.setOpen("jotDown");
      } else if (e.key === "o") {
        e.preventDefault();
        const data = await commands.openNotesDialog();

        openNotes(data);
      } else if (e.key === "n") {
        await newNote();
      }
    };
    const contextMenuEvent = (e: PointerEvent) => e.preventDefault();

    // We use capture: true to ensure it catches the event before anything else
    document.addEventListener("contextmenu", contextMenuEvent, {
      capture: true,
    });
    document.addEventListener("keydown", keydownEvent);

    let unlisten: UnlistenFn;

    (async () => {
      unlisten = await getCurrentWindow().onCloseRequested(async (e) => {
        e.preventDefault();

        await quit();
      });
    })();

    return () => {
      document.removeEventListener("keydown", keydownEvent);
      document.removeEventListener("contextmenu", contextMenuEvent, {
        capture: true,
      });
      unlisten();
    };
  });

  async function quit() {
    await jotStore.save();

    if (tabManager.tabs.some((t) => t.unsaved)) {
      overlayManager.setOpen("close-unsaved");
      return;
    }

    await commands.quit();
  }

  function openNote(data: OpenData) {
    tabManager.add(data.note_data, true, data.path);
  }
</script>

<div class="h-screen bg-base-3 text-content-1">
  <Modals />
  <div class="flex flex-col h-full">
    <Tabs />
    <div class="flex-1 relative h-full overflow-y-auto">
      {@render children()}
      <Popups />
    </div>
  </div>
</div>

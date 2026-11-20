<script lang="ts">
  import { onMount } from "svelte";
  import { commands, events, type OpenData } from "#lib/tauri/bindings.ts";
  import { timeout } from "#lib/util/timeout.ts";
  import { overlayManager } from "#lib/state/overlayManager.svelte.ts";
  import Modals from "./Modals.svelte";
  import NotebookDialogs from "./NotebookDialogs.svelte";
  import ContextMenu from "./ContextMenu.svelte";
  import Tabs from "#lib/components/Tabs.svelte";
  import { tabManager } from "#lib/state/tabManager.svelte.ts";
  import { newNote, openNotes } from "#lib/util/notes.svelte.ts";
  import Popups from "#lib/components/Popups.svelte";
  import { settingsStore } from "#lib/state/settingsStore.svelte.ts";
  import { defaultsStore } from "#lib/state/defaultsStore.svelte.ts";
  import type { UnlistenFn } from "@tauri-apps/api/event";
  import { getCurrentWindow } from "@tauri-apps/api/window";
  import { jotStore } from "#lib/state/jotStore.svelte.ts";
  import { handleDialog } from "#lib/util/dialog.ts";
  import DropOverlay from "#lib/components/DropOverlay.svelte";
  import { useAutosave } from "#lib/editor/autosave.svelte.ts";
  import { saveTab } from "#lib/editor/handleSave.svelte.ts";
  import { clearTextLayouts } from "#lib/editor/text.ts";
  import { clearTextBounds } from "#lib/editor/blocks.ts";
  import { requestRedraw } from "#lib/editor/render/scheduler.ts";

  const { children } = $props();

  useAutosave();

  // Text is measured with the note font; re-measure once it has loaded.
  onMount(() => {
    document.fonts?.ready.then(() => {
      clearTextLayouts();
      clearTextBounds();
      requestRedraw();
    });
  });

  onMount(async () => {
    await events.open.listen((e) => {
      openNote(e.payload);
    });

    await events.settingsUpdate.listen((e) => {
      settingsStore.store = e.payload;
    });

    await timeout(50);
    // Settings first: the title bar style must be applied before the window
    // becomes visible (ready() shows it), or it would visibly switch.
    settingsStore.store = await commands.getSettings();
    await getCurrentWindow().setDecorations(settingsStore.store.system_title_bar);
    await commands.ready();
    defaultsStore.store = await commands.getDefaults();
  });

  // Follow the title bar setting when it is changed at runtime.
  let decorated: boolean | undefined;
  $effect(() => {
    const want = settingsStore.store.system_title_bar;
    if (decorated !== undefined && want !== decorated)
      getCurrentWindow().setDecorations(want);
    decorated = want;
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
    let dialogUnlisten: UnlistenFn;

    (async () => {
      unlisten = await getCurrentWindow().onCloseRequested(async (e) => {
        e.preventDefault();

        await quit();
      });
      dialogUnlisten = await events.dialogEvent.listen(async (e) => {
        handleDialog(e.payload);
      });
    })();

    return () => {
      document.removeEventListener("keydown", keydownEvent);
      document.removeEventListener("contextmenu", contextMenuEvent, {
        capture: true,
      });
      unlisten();
      dialogUnlisten();
    };
  });

  async function quit() {
    await jotStore.save();

    if (settingsStore.store.autosave)
      await Promise.all(
        tabManager.tabs.filter((t) => t.unsaved).map((t) => saveTab(t, { silent: true })),
      );

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
  <DropOverlay />
  <Modals />
  <NotebookDialogs />
  <ContextMenu />
  <div class="flex flex-col h-full">
    <Tabs />
    <div class="flex-1 relative h-full overflow-y-auto">
      {@render children()}
      <Popups />
    </div>
  </div>
</div>

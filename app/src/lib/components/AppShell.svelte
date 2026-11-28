<script lang="ts">
  import { onMount } from "svelte";
  import { commands, events, type OpenData } from "#lib/tauri/bindings.ts";
  import { timeout } from "#lib/util/timeout.ts";
  import { overlayManager } from "#lib/state/overlayManager.svelte.ts";
  import Modals from "./Modals.svelte";
  import { popupManager } from "#lib/state/popupManager.svelte.ts";
  import ErrorPanel from "./ErrorPanel.svelte";
  import NotebookDialogs from "./NotebookDialogs.svelte";
  import ContextMenu from "./ContextMenu.svelte";
  import Tabs from "#lib/components/Tabs.svelte";
  import { tabManager } from "#lib/state/tabManager.svelte.ts";
  import { newNote, openNotes } from "#lib/util/notes.svelte.ts";
  import Popups from "#lib/components/Popups.svelte";
  import { settingsStore } from "#lib/state/settingsStore.svelte.ts";
  import { titleBar } from "#lib/state/titleBar.svelte.ts";
  import { defaultsStore } from "#lib/state/defaultsStore.svelte.ts";
  import { listenAll } from "#lib/util/listeners.ts";
  import { getCurrentWindow } from "@tauri-apps/api/window";
  import { jotStore } from "#lib/state/jotStore.svelte.ts";
  import { handleDialog } from "#lib/util/dialog.ts";
  import DropOverlay from "#lib/components/DropOverlay.svelte";
  import { handleDroppedFiles } from "#lib/editor/import/drop.ts";
  import { useAutosave } from "#lib/editor/autosave.svelte.ts";
  import { saveTab } from "#lib/editor/handleSave.svelte.ts";
  import { clearTextLayouts } from "#lib/editor/text.ts";
  import { clearTextBounds } from "#lib/editor/blocks.ts";
  import { requestRedraw } from "#lib/editor/render/scheduler.ts";
  import { enablePenWindowDrag } from "#lib/util/penWindowDrag.ts";

  const { children } = $props();

  useAutosave();

  // Errors outside rendering (e.g. a failed async action behind a button)
  // never reach a <svelte:boundary>. Say so instead of failing silently.
  onMount(() => {
    let last = "";
    let lastAt = 0;
    const report = (reason: unknown) => {
      console.error(reason);
      const message = reason instanceof Error ? reason.message : String(reason);
      // The same error in a burst (e.g. per pointer move) is shown once.
      if (message === last && Date.now() - lastAt < 3000) return;
      last = message;
      lastAt = Date.now();
      popupManager.add({ type: "destructive", message: `Something went wrong: ${message}` });
    };
    const onRejection = (e: PromiseRejectionEvent) => report(e.reason);
    const onError = (e: ErrorEvent) => report(e.error ?? e.message);
    window.addEventListener("unhandledrejection", onRejection);
    window.addEventListener("error", onError);
    return () => {
      window.removeEventListener("unhandledrejection", onRejection);
      window.removeEventListener("error", onError);
    };
  });

  // Text is measured with the note font; re-measure once it has loaded.
  onMount(() => {
    document.fonts?.ready.then(() => {
      clearTextLayouts();
      clearTextBounds();
      requestRedraw();
    });
  });

  onMount(() => {
    const listeners = listenAll(
      events.open.listen((e) => openNote(e.payload)),
      events.droppedFiles.listen((e) => handleDroppedFiles(e.payload)),
      events.settingsUpdate.listen((e) => {
        settingsStore.store = e.payload;
      }),
    );

    (async () => {
      // Listening first: ready() emits the files passed on the command line.
      await listeners.ready;
      await timeout(50);
      // Settings first, so the tab bar matches the window's title bar (which
      // the backend created from the same setting) before ready() shows it.
      settingsStore.store = await commands.getSettings();
      titleBar.init();
      await commands.ready();
      defaultsStore.store = await commands.getDefaults();
    })();

    return listeners.stop;
  });

  // Follow the title bar setting when it is changed at runtime.
  $effect(() => {
    titleBar.follow(settingsStore.store.system_title_bar);
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
    const stopPenDrag = enablePenWindowDrag();

    const listeners = listenAll(
      getCurrentWindow().onCloseRequested(async (e) => {
        e.preventDefault();
        await quit();
      }),
      events.dialogEvent.listen((e) => handleDialog(e.payload)),
    );

    return () => {
      document.removeEventListener("keydown", keydownEvent);
      stopPenDrag();
      document.removeEventListener("contextmenu", contextMenuEvent, {
        capture: true,
      });
      listeners.stop();
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
    tabManager.add(data.note_data, true, data.path, data.assets);
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
      <svelte:boundary onerror={(e) => console.error(e)}>
        {@render children()}
        {#snippet failed(error, reset)}
          <ErrorPanel {error} {reset} where="this page" />
        {/snippet}
      </svelte:boundary>
      <Popups />
    </div>
  </div>
</div>

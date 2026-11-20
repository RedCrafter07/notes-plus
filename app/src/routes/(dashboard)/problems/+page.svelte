<script lang="ts">
  import { revealItemInDir } from "@tauri-apps/plugin-opener";
  import {
    IconAlertTriangle,
    IconCircleCheck,
    IconFileAlert,
    IconFileBroken,
    IconFileUnknown,
    IconFolderOpen,
    IconLock,
    IconRefresh,
    IconTrash,
    IconVersions,
  } from "@tabler/icons-svelte";
  import { loadNotebooks, problemsStore } from "#lib/state/fsStore.svelte.ts";
  import { popupManager } from "#lib/state/popupManager.svelte.ts";
  import { commands, type FileProblem, type ProblemKind } from "#lib/tauri/bindings.ts";

  /*
   * Note files in the notebooks folder that could not be opened, each with a
   * plain explanation, the technical detail folded away, and what can be done:
   * show the file in the system file manager, or move it to the trash.
   */

  const KINDS: Record<
    ProblemKind,
    { title: string; advice: string; icon: typeof IconFileAlert; keep?: boolean }
  > = {
    newer_version: {
      title: "Made with a newer version",
      advice:
        "This note is fine, but it was saved by a newer RedNotes Plus. Update the app to open it. Don't delete it.",
      icon: IconVersions,
      keep: true,
    },
    unknown_version: {
      title: "Unknown file version",
      advice:
        "The file's version marker isn't one this app knows. It may be damaged, or come from a different program.",
      icon: IconFileUnknown,
    },
    damaged: {
      title: "Damaged note",
      advice:
        "Parts of the note are missing or broken, e.g. after a crash or an interrupted copy. If you have a backup, restore it from there.",
      icon: IconFileBroken,
    },
    not_a_note: {
      title: "Not a RedNotes Plus note",
      advice:
        "The file ends in .rnpf but isn't a note archive. It may have been renamed, or only partly downloaded.",
      icon: IconFileAlert,
    },
    unreadable: {
      title: "Can't be read",
      advice:
        "The app wasn't allowed to read this file, or it is locked by another program. Check its permissions, or close the other program and refresh.",
      icon: IconLock,
    },
  };

  let busy = $state(false);
  /** The card whose "Move to trash" has been pressed once; it asks again. */
  let confirming = $state<string>();
  let confirmTimer: ReturnType<typeof setTimeout> | undefined;

  async function refresh() {
    busy = true;
    try {
      await loadNotebooks();
    } finally {
      busy = false;
    }
  }

  async function reveal(p: FileProblem) {
    try {
      await revealItemInDir(p.path);
    } catch (e) {
      popupManager.add({ type: "destructive", message: `Could not show the file: ${e}` });
    }
  }

  async function trash(p: FileProblem) {
    // Two taps instead of a dialog: quick with a pen, still hard to hit by accident.
    if (confirming !== p.path) {
      confirming = p.path;
      clearTimeout(confirmTimer);
      confirmTimer = setTimeout(() => (confirming = undefined), 4000);
      return;
    }
    confirming = undefined;
    if (await commands.trashNoteFile(p.path)) {
      popupManager.add({ type: "success", message: `Moved "${p.name}" to the trash.` });
      await refresh();
    }
  }
</script>

<div class="container mx-auto flex flex-col gap-4">
  <div class="flex flex-row items-start gap-4 p-4 rounded-xl bg-base-2">
    <div class="flex-1 flex flex-col gap-1">
      <h1 class="text-xl flex flex-row gap-2 items-center font-semibold">
        <IconAlertTriangle class="text-destructive" /> File problems
      </h1>
      <p class="text-content-2">
        These files in your notebooks folder couldn't be opened. Nothing is
        changed until you choose an action. Moved files go to the system trash,
        where you can restore them.
      </p>
    </div>
    <button
      class="h-11 px-4 shrink-0 flex flex-row gap-2 items-center rounded-xl border-2 border-content-1/15 text-content-2 hover:text-content-1 hover:bg-overlay/30 active:scale-95 transition-all disabled:opacity-50"
      onclick={refresh}
      disabled={busy}
    >
      <IconRefresh size={20} class={busy ? "animate-spin" : ""} /> Check again
    </button>
  </div>

  {#each problemsStore.store as p (p.path)}
    {@const kind = KINDS[p.kind]}
    {@const Icon = kind.icon}
    <article
      class="flex flex-col gap-3 p-4 rounded-xl border-2 border-destructive/60 bg-destructive/10"
      aria-label="{kind.title}: {p.name}"
    >
      <div class="flex flex-row gap-3 items-start">
        <div class="w-11 h-11 shrink-0 grid place-items-center rounded-xl bg-destructive/20 text-destructive">
          <Icon />
        </div>
        <div class="flex-1 min-w-0 flex flex-col">
          <span class="text-sm font-semibold text-destructive">{kind.title}</span>
          <span class="text-lg font-semibold truncate" title={p.name}>{p.name}</span>
          <span class="text-sm text-content-3 font-mono truncate" title={p.path}>{p.path}</span>
        </div>
      </div>

      <p class="text-content-2">{kind.advice}</p>

      <details class="group rounded-lg bg-base-3/60 px-3 py-2">
        <summary class="cursor-pointer text-sm text-content-3 select-none">Technical details</summary>
        <p class="mt-2 text-sm font-mono text-content-2 break-words select-text">{p.detail}</p>
      </details>

      <div class="flex flex-row flex-wrap gap-2">
        <button
          class="h-11 px-4 flex flex-row gap-2 items-center rounded-xl border-2 border-content-1/15 text-content-1 hover:bg-overlay/30 active:scale-95 transition-all"
          onclick={() => reveal(p)}
        >
          <IconFolderOpen size={20} /> Show in folder
        </button>
        <button
          class={[
            "h-11 px-4 flex flex-row gap-2 items-center rounded-xl border-2 active:scale-95 transition-all",
            confirming === p.path
              ? "bg-destructive border-destructive text-destructive-content"
              : "border-destructive/60 text-destructive hover:bg-destructive/20",
          ]}
          onclick={() => trash(p)}
          title={kind.keep ? "This note is probably fine; updating the app is the better fix" : undefined}
        >
          <IconTrash size={20} />
          {confirming === p.path ? "Tap again to move to trash" : "Move to trash"}
        </button>
      </div>
    </article>
  {:else}
    <div class="flex flex-col items-center gap-2 p-10 rounded-xl bg-base-2 text-center">
      <IconCircleCheck size={40} class="text-success" />
      <p class="text-lg font-semibold">All notes can be opened</p>
      <p class="text-content-3">There are no problems in your notebooks folder.</p>
    </div>
  {/each}
</div>

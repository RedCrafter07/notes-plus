<script lang="ts">
  import { goto } from "$app/navigation";
  import { resolve } from "$app/paths";
  import { IconAlertTriangle, IconCopy, IconHome, IconRefresh } from "@tabler/icons-svelte";

  /*
   * Shown by a <svelte:boundary> when something crashes while rendering, in
   * place of the part that failed. Before, the editor silently jumped back to
   * the home page, which looked like a glitch rather than an error.
   */
  let {
    error,
    reset,
    where = "this view",
  }: {
    error: unknown;
    reset: () => void;
    /** e.g. "the editor", for the heading. */
    where?: string;
  } = $props();

  const message = $derived(error instanceof Error ? error.message : String(error));
  const details = $derived(
    error instanceof Error ? (error.stack ?? `${error.name}: ${error.message}`) : String(error),
  );
  let copied = $state(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(`${message}\n\n${details}`);
      copied = true;
      setTimeout(() => (copied = false), 2000);
    } catch {
      /* clipboard not available: the details are still selectable below */
    }
  }
</script>

<div class="h-full w-full overflow-y-auto grid place-items-center p-6 bg-base-1">
  <div
    class="w-full max-w-xl flex flex-col gap-4 p-5 rounded-2xl border-2 border-destructive/60 bg-destructive/10"
    role="alert"
  >
    <div class="flex flex-row gap-3 items-start">
      <div class="w-11 h-11 shrink-0 grid place-items-center rounded-xl bg-destructive/20 text-destructive">
        <IconAlertTriangle />
      </div>
      <div class="flex flex-col gap-1 min-w-0">
        <h2 class="text-lg font-semibold">Something went wrong in {where}</h2>
        <p class="text-content-2">
          This part of the app stopped because of an error. Your notes are still
          open in their tabs; nothing has been closed or deleted.
        </p>
      </div>
    </div>

    <p class="px-3 py-2 rounded-lg bg-base-3/60 font-mono text-sm break-words select-text">{message}</p>

    <details class="rounded-lg bg-base-3/60 px-3 py-2">
      <summary class="cursor-pointer text-sm text-content-3 select-none">Technical details</summary>
      <pre class="mt-2 text-xs text-content-2 whitespace-pre-wrap break-words select-text">{details}</pre>
    </details>

    <div class="flex flex-row flex-wrap gap-2">
      <button
        class="h-11 px-4 flex flex-row gap-2 items-center rounded-xl border-2 border-primary text-primary hover:bg-primary hover:text-base-1 font-semibold active:scale-95 transition-all"
        onclick={reset}
      >
        <IconRefresh size={20} /> Try again
      </button>
      <button
        class="h-11 px-4 flex flex-row gap-2 items-center rounded-xl border-2 border-content-1/15 text-content-1 hover:bg-overlay/30 active:scale-95 transition-all"
        onclick={async () => {
          await goto(resolve("/(dashboard)"));
          reset();
        }}
      >
        <IconHome size={20} /> Go to home
      </button>
      <button
        class="h-11 px-4 flex flex-row gap-2 items-center rounded-xl text-content-2 hover:bg-overlay/30 active:scale-95 transition-all"
        onclick={copy}
      >
        <IconCopy size={20} /> {copied ? "Copied" : "Copy details"}
      </button>
    </div>
  </div>
</div>

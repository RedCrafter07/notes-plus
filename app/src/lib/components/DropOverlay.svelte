<script lang="ts">
  import { events } from "#lib/tauri/bindings.ts";
  import type { UnlistenFn } from "@tauri-apps/api/event";
  import { cubicOut } from "svelte/easing";
  import { fade, scale } from "svelte/transition";

  import { page } from "$app/state";

  let notebooks = $state(0);
  let attachments = $state(0);
  const count = $derived(notebooks + attachments);
  const inEditor = $derived(page.route.id?.startsWith("/edit") ?? false);
  const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
  /** What dropping will do, e.g. "Drop to add 2 images or PDFs and open 1 notebook". */
  const label = $derived.by(() => {
    const parts = [];
    if (attachments)
      parts.push(
        inEditor
          ? `add ${plural(attachments, "image or PDF", "images or PDFs")}`
          : "add images or PDFs: open a notebook first",
      );
    if (notebooks) parts.push(`open ${plural(notebooks, "notebook", "notebooks")}`);
    return `Drop to ${parts.join(" and ")}`;
  });

  $effect(() => {
    let unlisten: UnlistenFn;

    (async () => {
      unlisten = await events.dragDropFileEvent.listen((e) => {
        notebooks = e.payload.notebooks;
        attachments = e.payload.attachments;
      });
    })();

    return () => {
      unlisten?.();
    };
  });
</script>

{#if count > 0}
  <div
    transition:fade={{ duration: 150 }}
    class="pointer-events-none fixed inset-0 z-50 flex items-center justify-center bg-base-3/70 backdrop-blur-sm"
  >
    <svg
      class="absolute inset-0 h-full w-full"
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
    >
      <rect
        x="0"
        y="0"
        width="100"
        height="100"
        fill="none"
        stroke="var(--color-primary)"
        stroke-width="8"
        stroke-dasharray="12 12"
        vector-effect="non-scaling-stroke"
        class="animate-ants"
      />
    </svg>
    <p
      class="text-2xl font-bold"
      in:scale={{ duration: 200, start: 0.9, easing: cubicOut }}
    >
      {label}
    </p>
  </div>
{/if}

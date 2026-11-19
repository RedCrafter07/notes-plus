<script lang="ts">
  import { contentManager } from "$lib/state/contentManager.svelte";
  import { canvasManager } from "./state/canvasManager.svelte";
  import { textEditor } from "./state/textEditor.svelte";
  import { TEXT_FONT_FAMILY, TEXT_LINE_HEIGHT } from "./text";

  let el = $state<HTMLTextAreaElement>();
  const zoom = $derived(contentManager.zoom);
  const d = $derived(textEditor.draft);
  const pos = $derived(d ? canvasManager.translateToAbsolute(d) : undefined);

  // Focus a newly opened box.
  $effect(() => {
    if (d && el && document.activeElement !== el) {
      el.focus();
      el.setSelectionRange(el.value.length, el.value.length);
    }
  });

  // Grow with the text instead of scrolling.
  $effect(() => {
    void d?.text;
    void zoom;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  });

  // Drag the right edge to change the wrap width.
  let resizing: { startX: number; startWidth: number } | undefined;
  function resizeStart(e: PointerEvent) {
    if (!d) return;
    e.preventDefault();
    (e.currentTarget as Element).setPointerCapture(e.pointerId);
    resizing = { startX: e.clientX, startWidth: d.width };
  }
  function resizeMove(e: PointerEvent) {
    if (!resizing || !textEditor.draft) return;
    textEditor.draft.width = Math.max(
      40,
      resizing.startWidth + (e.clientX - resizing.startX) / zoom,
    );
  }
</script>

{#if d && pos}
  <div
    data-ui="true"
    class="absolute"
    style="left: {pos.x}px; top: {pos.y}px; width: {d.width * zoom}px;"
  >
    <textarea
      bind:this={el}
      bind:value={textEditor.draft!.text}
      rows="1"
      spellcheck="true"
      placeholder="Type…"
      class="block w-full resize-none overflow-hidden bg-transparent p-0 m-0 border-0 outline-1 outline-dashed outline-primary/70 outline-offset-4 placeholder:opacity-40"
      style="font-family: {TEXT_FONT_FAMILY}; font-size: {d.fontSize * zoom}px; line-height: {TEXT_LINE_HEIGHT}; color: {d.color}; white-space: pre-wrap; overflow-wrap: anywhere;"
      onblur={() => textEditor.commit()}
      onkeydown={(e) => {
        if (e.key === "Escape") {
          e.stopPropagation();
          el?.blur();
        }
        // Ctrl+Z/Y should undo typing, not the canvas.
        if (e.ctrlKey && ["z", "y"].includes(e.key.toLowerCase()))
          e.stopPropagation();
      }}
    ></textarea>
    <!-- Width handle: wide enough to hit with a finger. -->
    <button
      type="button"
      tabindex="-1"
      aria-label="Resize text box"
      class="absolute top-0 -right-5 w-6 h-full flex items-center justify-center cursor-ew-resize touch-none"
      onmousedown={(e) => e.preventDefault()}
      onpointerdown={resizeStart}
      onpointermove={resizeMove}
      onpointerup={() => (resizing = undefined)}
    >
      <span class="w-1.5 h-6 rounded-full bg-primary/80"></span>
    </button>
  </div>
{/if}

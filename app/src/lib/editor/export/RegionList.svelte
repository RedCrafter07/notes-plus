<script lang="ts">
  import { IconGripVertical, IconTrash } from "@tabler/icons-svelte";
  import { formatLabel, type ExportRegion } from "./regions";

  /*
   * Regions in export order. Drag the grip to reorder: pointer events rather
   * than HTML drag-and-drop, which is unreliable with touch and pens. While
   * dragging, the other rows slide aside to show where the row will land;
   * the order is only committed on release (one undo step).
   */
  let {
    regions,
    selected = $bindable(),
    offset = 0,
    onreorder,
    onremove,
  }: {
    regions: ExportRegion[];
    selected?: string;
    /** Number shown for the first row (regions on earlier pages). */
    offset?: number;
    onreorder: (from: number, to: number) => void;
    onremove: (id: string) => void;
  } = $props();

  const GAP = 8;
  let rowHeight = $state(56);
  let drag = $state<{ from: number; startY: number; dy: number; pointer: number }>();

  /** Where the dragged row would land. */
  const target = $derived.by(() => {
    if (!drag) return -1;
    const step = rowHeight + GAP;
    const to = drag.from + Math.round(drag.dy / step);
    return Math.max(0, Math.min(regions.length - 1, to));
  });

  /** How far a row is shifted while another one is dragged over it. */
  function shift(i: number) {
    if (!drag) return 0;
    const step = rowHeight + GAP;
    if (i === drag.from) return drag.dy;
    if (drag.from < target && i > drag.from && i <= target) return -step;
    if (drag.from > target && i < drag.from && i >= target) return step;
    return 0;
  }

  function down(e: PointerEvent, i: number) {
    e.preventDefault();
    (e.currentTarget as Element).setPointerCapture(e.pointerId);
    drag = { from: i, startY: e.clientY, dy: 0, pointer: e.pointerId };
    selected = regions[i].id;
  }

  function moveDrag(e: PointerEvent) {
    if (drag && e.pointerId === drag.pointer) drag.dy = e.clientY - drag.startY;
  }

  function up(e: PointerEvent) {
    if (!drag || e.pointerId !== drag.pointer) return;
    const { from } = drag;
    const to = target;
    drag = undefined;
    if (to !== from) onreorder(from, to);
  }

  function key(e: KeyboardEvent, i: number) {
    // Keyboard reordering for the grip: Alt+Up/Down.
    if (!e.altKey) return;
    if (e.key === "ArrowUp" && i > 0) onreorder(i, i - 1);
    if (e.key === "ArrowDown" && i < regions.length - 1) onreorder(i, i + 1);
  }
</script>

<ol class="flex flex-col relative" style="gap: {GAP}px;">
  {#each regions as r, i (r.id)}
    {@const active = r.id === selected}
    {@const dragging = drag?.from === i}
    <li
      bind:clientHeight={rowHeight}
      class={[
        "flex flex-row items-center rounded-xl border-2 bg-base-1",
        dragging ? "z-10 shadow-xl scale-[1.02]" : "transition-transform duration-150",
        active ? "border-info" : "border-content-1/10",
      ]}
      style="transform: translateY({shift(i)}px);"
    >
      <button
        class="w-10 h-12 shrink-0 grid place-items-center text-content-3 hover:text-content-1 cursor-grab active:cursor-grabbing touch-none"
        aria-label="Reorder {r.name} (Alt+Up/Down)"
        title="Drag to reorder"
        onpointerdown={(e) => down(e, i)}
        onpointermove={moveDrag}
        onpointerup={up}
        onpointercancel={up}
        onkeydown={(e) => key(e, i)}
      >
        <IconGripVertical size={20} />
      </button>
      <button
        class="flex-1 min-w-0 flex flex-row items-center gap-3 py-3 pr-2 text-left"
        onclick={() => (selected = r.id)}
        aria-pressed={active}
      >
        <span class="w-5 text-content-3 tabular-nums">{offset + i + 1}</span>
        <span class="flex-1 truncate font-semibold">{r.name}</span>
        <span class="text-sm text-content-3">{formatLabel(r)}</span>
      </button>
      <button
        class="w-11 h-12 grid place-items-center text-content-3 hover:text-destructive transition-all"
        onclick={() => onremove(r.id)}
        aria-label="Remove {r.name}"
      >
        <IconTrash size={18} />
      </button>
    </li>
  {/each}
</ol>

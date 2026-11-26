<script lang="ts">
  /**
   * A range control made for pen and touch, replacing `<input type="range">`
   * (a tiny thumb that has to be hit exactly):
   *
   * - The whole track is a target: tap anywhere to jump there, then drag.
   * - Fine control: while dragging, move the pen away from the track and
   *   the value moves slower (1/4 beyond 40 px, 1/10 beyond 120 px), like
   *   scrubbing on a phone. Back near the track, full speed again.
   * - Keyboard: arrows, Page Up/Down (10 steps), Home/End.
   *
   * `onchange` fires on every change while dragging; `oncommit` once when
   * the drag ends (or per key press), for changes that are undo steps.
   */
  let {
    value,
    min,
    max,
    step = 1,
    label,
    track,
    onchange,
    oncommit,
  }: {
    value: number;
    min: number;
    max: number;
    step?: number;
    /** Accessible name. */
    label: string;
    /** CSS background for the track (e.g. a colour gradient); default is a filled bar. */
    track?: string;
    onchange: (v: number) => void;
    oncommit?: (v: number) => void;
  } = $props();

  let el = $state<HTMLDivElement>();
  let dragging = $state(false);

  const fraction = $derived(max > min ? (value - min) / (max - min) : 0);
  const decimals = $derived((String(step).split(".")[1] ?? "").length);

  function snap(v: number) {
    const s = Math.round((v - min) / step) * step + min;
    return +Math.min(max, Math.max(min, s)).toFixed(decimals);
  }

  /** The last value sent, for `oncommit`. */
  let latest = 0;

  function set(v: number) {
    const next = snap(v);
    latest = next;
    if (next !== value) onchange(next);
  }

  // Dragging works on an unsnapped value, so slow movements add up.
  let raw = 0;
  let lastX = 0;

  function down(e: PointerEvent) {
    if (!el || e.button !== 0) return;
    e.preventDefault();
    el.setPointerCapture(e.pointerId);
    el.focus();
    const r = el.getBoundingClientRect();
    raw = min + ((e.clientX - r.left) / r.width) * (max - min);
    lastX = e.clientX;
    dragging = true;
    set(raw);
  }

  function move(e: PointerEvent) {
    if (!dragging || !el) return;
    const r = el.getBoundingClientRect();
    const away = Math.max(0, r.top - e.clientY, e.clientY - r.bottom);
    const speed = away > 120 ? 0.1 : away > 40 ? 0.25 : 1;
    raw += ((e.clientX - lastX) / r.width) * (max - min) * speed;
    raw = Math.min(max, Math.max(min, raw));
    lastX = e.clientX;
    set(raw);
  }

  function up() {
    if (!dragging) return;
    dragging = false;
    oncommit?.(latest);
  }

  function key(e: KeyboardEvent) {
    const big = step * 10;
    const next: Record<string, number> = {
      ArrowRight: value + step,
      ArrowUp: value + step,
      ArrowLeft: value - step,
      ArrowDown: value - step,
      PageUp: value + big,
      PageDown: value - big,
      Home: min,
      End: max,
    };
    if (!(e.key in next)) return;
    e.preventDefault();
    set(next[e.key]);
    oncommit?.(latest);
  }
</script>

<div
  bind:this={el}
  role="slider"
  tabindex="0"
  aria-label={label}
  aria-valuemin={min}
  aria-valuemax={max}
  aria-valuenow={value}
  class="relative h-10 w-full touch-none select-none cursor-pointer outline-none group"
  onpointerdown={down}
  onpointermove={move}
  onpointerup={up}
  onpointercancel={up}
  onkeydown={key}
>
  <div
    class="absolute inset-x-0 top-1/2 -translate-y-1/2 h-2 rounded-full bg-overlay/30 overflow-hidden"
    style:background={track}
  >
    {#if !track}
      <div class="h-full bg-primary" style:width="{fraction * 100}%"></div>
    {/if}
  </div>
  <div
    class={[
      "absolute top-1/2 w-6 h-6 -translate-x-1/2 -translate-y-1/2 rounded-full bg-content-1 border-2 border-primary shadow transition-transform",
      "group-focus-visible:ring-2 group-focus-visible:ring-primary group-focus-visible:ring-offset-2 group-focus-visible:ring-offset-base-1",
      dragging ? "scale-125" : "",
    ]}
    style:left="{fraction * 100}%"
  ></div>
</div>

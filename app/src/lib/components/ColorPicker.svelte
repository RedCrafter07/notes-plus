<script lang="ts">
  import { clamp, hexToHsv, hsvToHex, normalizeHex } from "$lib/util/colors";

  let {
    value = $bindable("#000000"),
  }: {
    /** The picked color as a `#rrggbb` hex string. Two-way bindable. */
    value: string;
  } = $props();

  // Hue (0-360), saturation (0-1) and value (0-1) are the source of truth
  // inside the component. `value` is derived from them on every change.
  let h = $state(0);
  let s = $state(0);
  let v = $state(0);

  // Text mirrored into the hex input. Kept separate from `value` so a partial
  // or invalid entry (e.g. "#12") does not corrupt the picked color.
  let hexInput = $state("#000000");

  // The last hex we emitted ourselves. Lets us tell an external `value` change
  // apart from our own, so dragging a slider never clobbers h/s/v (important
  // for greyscale, where the hue would otherwise be lost on the round-trip).
  let lastHex = "";

  // Sync h/s/v from an externally-driven `value`.
  $effect(() => {
    const hex = value;
    if (hex === lastHex) return;

    const parsed = hexToHsv(hex);
    if (parsed) [h, s, v] = parsed;

    lastHex = normalizeHex(hex) ?? hex;
    hexInput = lastHex;
  });

  function commit() {
    const hex = hsvToHex([h, s, v]);
    lastHex = hex;
    hexInput = hex;
    value = hex;
  }

  function onHexInput(e: Event & { currentTarget: HTMLInputElement }) {
    hexInput = e.currentTarget.value;
    const normalized = normalizeHex(hexInput);
    if (!normalized) return;

    const parsed = hexToHsv(normalized);
    if (parsed) [h, s, v] = parsed;
    lastHex = normalized;
    value = normalized;
  }

  function onHexBlur() {
    hexInput = normalizeHex(hexInput) ?? lastHex;
  }

  // --- 2D saturation/value area -------------------------------------------
  let svArea = $state<HTMLDivElement>();
  let dragging = false;

  function pickSV(e: PointerEvent) {
    if (!svArea) return;
    const rect = svArea.getBoundingClientRect();
    s = clamp((e.clientX - rect.left) / rect.width, 0, 1);
    v = clamp(1 - (e.clientY - rect.top) / rect.height, 0, 1);
    commit();
  }

  function onSvDown(e: PointerEvent) {
    dragging = true;
    svArea?.setPointerCapture(e.pointerId);
    pickSV(e);
  }

  function onSvMove(e: PointerEvent) {
    if (dragging) pickSV(e);
  }

  function onSvUp(e: PointerEvent) {
    dragging = false;
    svArea?.releasePointerCapture(e.pointerId);
  }

  // --- gradient backgrounds for the previews/tracks -----------------------
  const hueColor = $derived(hsvToHex([h, 1, 1]));
  const satTrack = $derived(
    `linear-gradient(to right, ${hsvToHex([h, 0, v || 1])}, ${hsvToHex([h, 1, v || 1])})`,
  );
  const valTrack = $derived(
    `linear-gradient(to right, ${hsvToHex([h, s, 0])}, ${hsvToHex([h, s, 1])})`,
  );
</script>

<div class="flex w-full flex-col gap-3 text-content-1">
  <!-- Saturation / value gradient area -->
  <div
    bind:this={svArea}
    class="sv-area relative h-40 w-full overflow-hidden rounded-xl border-2 border-base-3"
    style="background:
      linear-gradient(to top, #000, transparent),
      linear-gradient(to right, #fff, transparent),
      {hueColor};"
    onpointerdown={onSvDown}
    onpointermove={onSvMove}
    onpointerup={onSvUp}
    role="slider"
    tabindex="0"
    aria-label="Saturation and brightness"
    aria-valuemin="0"
    aria-valuemax="100"
    aria-valuenow={Math.round(s * 100)}
    aria-valuetext={value}
  >
    <div
      class="sv-thumb"
      style="left: {s * 100}%; top: {(1 - v) * 100}%; background-color: {value};"
    ></div>
  </div>

  <!-- Hue slider -->
  <label class="flex flex-col gap-1">
    <span class="text-sm text-content-2">Hue</span>
    <input
      type="range"
      class="range"
      min="0"
      max="360"
      step="1"
      bind:value={h}
      oninput={commit}
      style="background: linear-gradient(to right, #f00, #ff0, #0f0, #0ff, #00f, #f0f, #f00);"
      aria-label="Hue"
    />
  </label>

  <!-- Saturation slider -->
  <label class="flex flex-col gap-1">
    <span class="text-sm text-content-2">Saturation</span>
    <input
      type="range"
      class="range"
      min="0"
      max="1"
      step="0.001"
      bind:value={s}
      oninput={commit}
      style="background: {satTrack};"
      aria-label="Saturation"
    />
  </label>

  <!-- Value slider -->
  <label class="flex flex-col gap-1">
    <span class="text-sm text-content-2">Value</span>
    <input
      type="range"
      class="range"
      min="0"
      max="1"
      step="0.001"
      bind:value={v}
      oninput={commit}
      style="background: {valTrack};"
      aria-label="Value"
    />
  </label>

  <!-- Hex input with live preview swatch -->
  <div class="flex w-full flex-row items-center gap-2 rounded-xl bg-base-3 px-3 py-2">
    <div
      class="h-6 w-6 shrink-0 rounded-full border-2 border-content-3"
      style="background-color: {value};"
    ></div>
    <input
      type="text"
      class="w-full flex-1 select-text uppercase focus:outline-none"
      value={hexInput}
      oninput={onHexInput}
      onblur={onHexBlur}
      spellcheck="false"
      autocomplete="off"
      aria-label="Hex color value"
    />
  </div>
</div>

<style>
  .sv-area {
    touch-action: none;
    cursor: crosshair;
  }

  .sv-thumb {
    position: absolute;
    width: 14px;
    height: 14px;
    border-radius: 9999px;
    border: 2px solid #fff;
    box-shadow: 0 0 0 1px rgba(0, 0, 0, 0.4);
    transform: translate(-50%, -50%);
    pointer-events: none;
  }

  .range {
    -webkit-appearance: none;
    appearance: none;
    width: 100%;
    height: 12px;
    border-radius: 9999px;
    cursor: pointer;
    outline: none;
  }

  .range::-webkit-slider-thumb {
    -webkit-appearance: none;
    appearance: none;
    width: 18px;
    height: 18px;
    border-radius: 9999px;
    background: var(--content-1);
    border: 2px solid var(--base-1);
    box-shadow: 0 0 0 1px rgba(0, 0, 0, 0.3);
    cursor: pointer;
  }

  .range::-moz-range-thumb {
    width: 18px;
    height: 18px;
    border-radius: 9999px;
    background: var(--content-1);
    border: 2px solid var(--base-1);
    box-shadow: 0 0 0 1px rgba(0, 0, 0, 0.3);
    cursor: pointer;
  }
</style>

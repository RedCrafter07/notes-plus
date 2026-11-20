<script lang="ts">
  import {
    IconEyeOff,
    IconFocusCentered,
    IconPlayerStop,
    IconSnowflake,
    IconViewfinder,
  } from "@tabler/icons-svelte";
  import { presenter } from "./presenter.svelte";

  /*
   * Shown in the editor while presenting, so it is always obvious that
   * people are watching, with the controls a presenter reaches for:
   * what the audience sees (Fit/Follow), Freeze, Blank, Stop.
   */
  const btn = (on: boolean) =>
    `w-10 h-10 rounded-xl grid place-items-center transition-all active:scale-95 ${
      on ? "bg-primary text-base-1" : "text-content-2 hover:bg-overlay/30 hover:text-content-1"
    }`;
</script>

{#if presenter.active}
  <div
    class="absolute bottom-3 right-3 z-20 flex flex-row items-center gap-1 p-1 rounded-2xl bg-base-1/95 shadow-lg border border-content-1/10"
    role="toolbar"
    aria-label="Presenter controls"
  >
    <span class="flex flex-row items-center gap-2 px-2 text-sm font-semibold">
      <span
        class={["w-2.5 h-2.5 rounded-full", presenter.blank || presenter.frozen ? "bg-warning" : "bg-destructive animate-pulse"]}
      ></span>
      {presenter.blank ? "Blank" : presenter.frozen ? "Frozen" : "Live"}
      <span class="text-content-3 font-normal max-w-28 truncate" title={presenter.display}>{presenter.display}</span>
    </span>
    <button
      class={btn(presenter.mode === "fit")}
      onclick={() => (presenter.mode = "fit")}
      title="Fit: the audience sees the whole page"
      aria-label="Fit page"
      aria-pressed={presenter.mode === "fit"}
    >
      <IconFocusCentered size={18} />
    </button>
    <button
      class={btn(presenter.mode === "follow")}
      onclick={() => (presenter.mode = "follow")}
      title="Follow: the audience sees exactly what you see"
      aria-label="Follow my view"
      aria-pressed={presenter.mode === "follow"}
    >
      <IconViewfinder size={18} />
    </button>
    <button
      class={btn(presenter.frozen)}
      onclick={() => (presenter.frozen = !presenter.frozen)}
      title="Freeze: keep showing the current picture while you navigate"
      aria-label="Freeze"
      aria-pressed={presenter.frozen}
    >
      <IconSnowflake size={18} />
    </button>
    <button
      class={btn(presenter.blank)}
      onclick={() => (presenter.blank = !presenter.blank)}
      title="Blank: show a black screen"
      aria-label="Blank screen"
      aria-pressed={presenter.blank}
    >
      <IconEyeOff size={18} />
    </button>
    <button
      class="w-10 h-10 rounded-xl grid place-items-center text-destructive hover:bg-destructive hover:text-destructive-content transition-all active:scale-95"
      onclick={() => presenter.stop()}
      title="Stop presenting (F5)"
      aria-label="Stop presenting"
    >
      <IconPlayerStop size={18} />
    </button>
  </div>
{/if}

<script lang="ts">
  import BackgroundPatterns from "$lib/editor/BackgroundPatterns.svelte";
  import { contentManager } from "$lib/state/contentManager.svelte";
  import { overlayManager } from "$lib/state/overlayManager.svelte";
  import type { BackgroundPattern } from "$lib/tauri/bindings";
  import { IconDeviceFloppy } from "@tabler/icons-svelte";
  import Input from "./Input.svelte";
  import Overlay from "./Overlay.svelte";
  import ColorInput from "./ColorInput.svelte";

  let visible = $derived(
    overlayManager.open?.startsWith("pagesettings-") ?? false,
  );

  let pageIndex = $derived(parseInt(overlayManager.open?.split("-")[1] ?? "0"));

  function closeCb() {
    overlayManager.close();
  }

  // svelte-ignore state_referenced_locally
  let bgColor = $state("#ffffff");
  // svelte-ignore state_referenced_locally
  let patternColor = $state("#dddddd");
  // svelte-ignore state_referenced_locally
  let pattern = $state<BackgroundPattern | null>(null);
  // svelte-ignore state_referenced_locally
  let patternScale = $state(16);
  // svelte-ignore state_referenced_locally
  let pageName = $state("Page 0");

  $effect(() => {
    if (contentManager.pages[pageIndex]) {
      bgColor = contentManager.pages[pageIndex].background_color;
      patternColor = contentManager.pages[pageIndex].pattern_color;
      patternScale = contentManager.pages[pageIndex].pattern_scale;
      pageName = contentManager.pages[pageIndex].name;
      pattern = contentManager.pages[pageIndex].pattern;
    }
  });

  function save() {
    contentManager.pages[pageIndex].name = pageName;
    contentManager.pages[pageIndex].pattern_color = patternColor;
    contentManager.pages[pageIndex].pattern_scale = patternScale;
    contentManager.pages[pageIndex].background_color = bgColor;
    contentManager.pages[pageIndex].pattern = pattern;

    overlayManager.close();
  }
</script>

{#snippet backgroundType(type: BackgroundPattern | "Blank")}
  {@const active = pattern === (type === "Blank" ? null : type)}
  <button
    onclick={() => {
      if (type === "Blank") pattern = null;
      else pattern = type;
    }}
    class={[
      "aspect-square rounded-xl overflow-hidden border-4 transition-all active:scale-95",
      active ? "border-primary" : "border-transparent",
    ]}
    style="background-color: {bgColor};"
  >
    {#if type !== "Blank"}
      <BackgroundPatterns
        pattern={type}
        color={patternColor}
        scale={patternScale}
      />
    {/if}
  </button>
{/snippet}

{#if contentManager.pages.length > 0}
  <Overlay {visible} {closeCb} title="Page Settings">
    <div class="flex flex-col">
      <Input id="page-name" placeholder="Page 1" bind:value={pageName} />
    </div>
    <div class="grid grid-cols-4 w-full gap-4 items-center">
      {@render backgroundType("Squares")}
      {@render backgroundType("Dots")}
      {@render backgroundType("Lines")}
      {@render backgroundType("Blank")}
    </div>

    <div class="flex flex-col gap-1">
      <ColorInput id="bg-color" bind:value={bgColor} label="Page Background" />
    </div>
    <div class="flex flex-col gap-1">
      <ColorInput
        id="bg-color"
        bind:value={patternColor}
        label="Pattern color"
      />
    </div>

    <div class="sticky bottom-0">
      <button
        class="p-2 rounded-xl border-2 border-success text-success hover:bg-success bg-base-1 hover:text-success-content transition-all flex flex-row gap-2 items-center justify-center font-bold tracking-wider active:scale-95 w-full"
        onclick={save}
      >
        <IconDeviceFloppy />
        <p>Save</p>
      </button>
    </div>
  </Overlay>
{/if}

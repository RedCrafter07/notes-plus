<script lang="ts">
  import type { Snippet } from "svelte";
  import type { FocusEventHandler } from "svelte/elements";

  let {
    label,
    description,
    component = $bindable(),
    value = $bindable(),
    id,
    placeholder,
    onBlur,
    children,
    tabIndex,
  }: {
    component?: HTMLInputElement;
    value?: string;
    id: string;
    label?: string;
    description?: string;
    placeholder?: string;
    onBlur?: FocusEventHandler<HTMLInputElement>;
    children?: Snippet<[]>;
    tabIndex?: number;
  } = $props();
</script>

{#if label}
  <label for={`#${id}`} class="text-xl">{label}</label>
{/if}

{#if description}
  <p class="text-content-1/75">
    {description}
  </p>
{/if}
<div class="flex flex-row gap-2 w-full py-2 px-3 rounded-xl bg-base-3">
  <input
    bind:this={component}
    tabindex={tabIndex}
    type="text"
    class="w-full flex-1 focus:outline-none select-text"
    bind:value
    onblur={onBlur}
    autocomplete="off"
    {id}
    {placeholder}
  />
  {@render children?.()}
</div>

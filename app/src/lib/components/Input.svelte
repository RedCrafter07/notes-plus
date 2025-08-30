<script lang="ts">
  import type { Snippet } from "svelte";
  import type { FocusEventHandler } from "svelte/elements";

  const {
    label,
    description,
    value,
    id,
    placeholder,
    onBlur,
    children,
  }: {
    value?: string;
    id: string;
    label: string;
    description?: string;
    placeholder?: string;
    onBlur?: FocusEventHandler<HTMLInputElement>;
    children?: Snippet<[]>;
  } = $props();
</script>

<label for={`#${id}`} class="text-xl">{label}</label>

{#if description}
  <p class="text-content-1/75">
    {description}
  </p>
{/if}
<div class="flex flex-row gap-2 w-full py-2 px-3 rounded-xl bg-base-3">
  <input
    type="text"
    class="w-full flex-1 focus:outline-none"
    {value}
    onblur={onBlur}
    {id}
    {placeholder}
  />
  {@render children?.()}
</div>

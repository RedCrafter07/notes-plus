<script lang="ts">
  import type { FocusEventHandler } from "svelte/elements";
  import ColorPicker from "./ColorSwatch.svelte";
  import Input from "./Input.svelte";

  let {
    id,
    value = $bindable(),
    ...rest
  }: {
    id: string;
    value: string;
    component?: HTMLInputElement;
    label?: string;
    description?: string;
    placeholder?: string;
    onBlur?: FocusEventHandler<HTMLInputElement>;
    tabIndex?: number;
  } = $props();
</script>

<Input {id} bind:value {...rest}>
  <ColorPicker bind:value />
</Input>

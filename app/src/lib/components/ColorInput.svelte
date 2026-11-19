<script lang="ts">
  import ColorSwatch from "./ColorSwatch.svelte";
  import Input from "./Input.svelte";

  /*
   * A hex field plus a swatch. Typing edits a draft; the value only changes
   * (and `onChange` fires) once the draft is a valid #rrggbb colour and the
   * field loses focus, or when a colour is picked from the swatch.
   */
  let {
    id,
    value = $bindable(),
    onChange,
    label,
    description,
    placeholder,
  }: {
    id: string;
    value: string;
    onChange?: (v: string) => void;
    label?: string;
    description?: string;
    placeholder?: string;
  } = $props();

  let draft = $state("");
  $effect.pre(() => {
    draft = value;
  });

  function commit(v: string) {
    if (/^#[0-9a-f]{6}$/i.test(v)) {
      if (v !== value) {
        value = v;
        onChange?.(v);
      }
    } else {
      draft = value;
    }
  }
</script>

<div class="flex flex-col gap-1">
  <Input
    {id}
    {label}
    {description}
    {placeholder}
    bind:value={draft}
    onBlur={() => commit(draft.trim())}
    onKeyDown={(e) => {
      if (e.key === "Enter") commit(draft.trim());
    }}
  >
    <ColorSwatch value={draft} onchange={commit} />
  </Input>
</div>

<script lang="ts">
  let {
    id,
    checked = $bindable(),
    label,
    description,
    onChange,
  }: {
    id: string;
    checked?: boolean;
    label?: string;
    description?: string;
    onChange?: (v: boolean) => Promise<void> | void;
  } = $props();
</script>

<input type="checkbox" {checked} {id} class="hidden" />

<button
  role="checkbox"
  aria-checked={checked}
  onclick={async () => {
    if (onChange) await onChange(!checked);
    else checked = !checked;
  }}
  class="flex flex-row items-center gap-4"
>
  <div
    class={[
      "w-10 h-6 rounded-full transition-all p-1 relative min-w-10",
      checked ? "bg-success" : "bg-content-3",
    ]}
  >
    <div
      class={[
        "w-4 aspect-square rounded-xl bg-base-1 absolute transition-all",
        checked ? "left-5" : "left-1",
      ]}
    ></div>
  </div>
  {#if label}
    <div class="flex flex-col gap-1 justify-center items-start text-left">
      <p>{label}</p>
      <p class="text-sm text-content-3">{description}</p>
    </div>
  {/if}
</button>

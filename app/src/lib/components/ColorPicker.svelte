<script lang="ts">
  let {
    value = $bindable(),
  }: {
    value: string;
  } = $props();
</script>

<div class="relative w-6 h-6">
  <div
    class="absolute inset-0 rounded-full border-content-3 border-2 pointer-events-none"
    style="background-color: {value};"
  ></div>

  <input
    type="color"
    class="absolute inset-0 opacity-0 w-full h-full cursor-pointer"
    bind:value
    aria-label="Choose color"
  />
</div>

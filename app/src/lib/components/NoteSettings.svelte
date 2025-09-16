<script lang="ts">
  import type { PageManager } from "$lib/canvas/PageManager.svelte";
  import type { Note } from "$lib/types/bindings/Note";
  import type { Tab } from "$lib/types/tabs";
  import Input from "./Input.svelte";
  import Overlay from "./Overlay.svelte";

  const {
    closeCb,
    visible,
    data,
  }: {
    closeCb: () => void;
    visible: boolean;
    data?: { page: PageManager; tab?: Tab };
  } = $props();
</script>

<Overlay {closeCb} title="Note settings" minHeight={false} {visible}>
  <p>The values here save automatically!</p>
  <Input
    label="Note title"
    value={data?.page.meta.title}
    id="title"
    onBlur={(e) => {
      if (data) data.page.meta.title = e.currentTarget.value;
    }}
  />
  <Input
    label="Tags"
    value={data?.page.meta.tags.join(",")}
    onBlur={(e) => {
      if (data) data.page.meta.tags = e.currentTarget.value.split(",");
    }}
    id="tags"
  />
  More options coming soon!
</Overlay>

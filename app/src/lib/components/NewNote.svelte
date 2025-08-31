<script lang="ts">
  import { tabManager } from "$lib/tabs/tabs.svelte";
  import { IconPlus } from "@tabler/icons-svelte";
  import Input from "./Input.svelte";
  import Overlay from "./Overlay.svelte";

  const {
    visible,
    closeCb,
  }: {
    closeCb: () => void;
    visible: boolean;
  } = $props();

  let title = $state<string>();
  let tags = $state<string[]>([]);

  function create() {
    tabManager.addTab("new", true, {
      title,
      tags,
    });
  }
</script>

<Overlay {closeCb} {visible} title="Create new note" minHeight={true}>
  <div>
    <Input
      tabIndex={0}
      id="note-title"
      label="Note Title"
      description="The display name of the note."
      placeholder="New Note"
      onBlur={(e) => {
        title = e.currentTarget.value;
      }}
      value={title}
    />
  </div>
  <div>
    <Input
      id="note-tags"
      label="Tags"
      description="(optional) Add comma-separated tags here. They may be used for easier categorization."
      placeholder="work,important"
      onBlur={(e) => {
        const newTags = e.currentTarget.value.split(",").map((v) => v.trim());

        if (newTags.filter((t) => t.length === 0).length > 0) return;

        tags = newTags;
      }}
      value={tags ? tags.join(",") : undefined}
    />
  </div>
  <button
    class="flex flex-row gap-4 justify-center w-full border-success text-success border hover:text-success-content hover:bg-success active:scale-95 transition-all py-2 px-3 rounded-xl cursor-pointer"
    onclick={() => {
      create();
    }}
  >
    <IconPlus /> <span>Create new note!</span>
  </button>
</Overlay>

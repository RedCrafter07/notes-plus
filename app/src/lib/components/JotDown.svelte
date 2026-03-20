<script lang="ts">
  import { overlayManager } from "$lib/state/overlayManager.svelte";
  import { IconPencil } from "@tabler/icons-svelte";
  import Input from "./Input.svelte";
  import Overlay from "./Overlay.svelte";
  import { commands } from "$lib/tauri/bindings";

  let visible = $derived(overlayManager.open === "jotDown");
  let note = $state("");
  let input = $state<HTMLInputElement>();

  $effect(() => {
    if (visible == true) {
      input?.focus();
    }
  });

  const closeCb = () => {
    overlayManager.close();
  };

  async function submit(text: string) {
    await commands.addJotNote(text);
    note = "";
    overlayManager.close();
  }
</script>

<Overlay title="Jot Down" {closeCb} {visible} minHeight>
  <form
    onsubmit={(e) => {
      e.preventDefault();
      submit(note);
    }}
  >
    <Input
      tabIndex={0}
      bind:component={input}
      bind:value={note}
      id="note"
      placeholder="Very important"
    >
      <button
        class="aspect-square items-center flex flex-row gap-4 justify-center focus:outline-none border-success text-success border-2 hover:text-success-content hover:bg-success focus:bg-success/10 active:scale-95 transition-all p-2 rounded-xl cursor-pointer"
      >
        <IconPencil />
      </button>
    </Input>
  </form>
</Overlay>

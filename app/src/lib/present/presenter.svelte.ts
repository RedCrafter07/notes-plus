import { emitTo, listen } from "@tauri-apps/api/event";
import { commands, events } from "#lib/tauri/bindings.ts";
import { popupManager } from "#lib/state/popupManager.svelte.ts";
import { AUDIENCE, PRESENT_EVENT, READY_EVENT, type PresentMessage, type ViewMode } from "./protocol";

/*
 * Editor-side presenter state. The audience window is a plain viewer: it
 * holds no note, only what it is sent. `usePresenterSync` (in the editor
 * page) decides what to send; this class owns the window and the channel.
 */
class Presenter {
  active = $state(false);
  /** Where the audience view is, e.g. "HDMI-1" or "Window". */
  display = $state("");
  secondDisplay = $state(false);
  mode = $state<ViewMode>("fit");
  /** Freeze: the audience keeps showing the last frame while you navigate. */
  frozen = $state(false);
  /** Blank: the audience sees a black screen. */
  blank = $state(false);
  /** Bumped when the audience (re)loads and needs everything resent. */
  resync = $state(0);

  #listening = false;

  async #listen() {
    if (this.#listening) return;
    this.#listening = true;
    await listen(READY_EVENT, () => this.resync++);
    await events.presentEnded.listen(() => this.#reset());
  }

  async start() {
    await this.#listen();
    const r = await commands.startPresenting();
    if (!r) return;
    this.active = true;
    this.display = r.display;
    this.secondDisplay = r.second_display;
    this.frozen = false;
    this.blank = false;
    popupManager.add({
      type: "info",
      message: r.second_display
        ? `Presenting on ${r.display}. Press F5 or Stop to end.`
        : "No second display found: the audience view opened as a window you can share or move.",
    });
  }

  async stop() {
    await commands.stopPresenting();
    this.#reset();
  }

  toggle() {
    return this.active ? this.stop() : this.start();
  }

  #reset() {
    this.active = false;
    this.frozen = false;
    this.blank = false;
  }

  #queue = new Map<PresentMessage["kind"], PresentMessage>();
  #frame = 0;

  /**
   * Queues a message; at most one per kind is sent per animation frame (the
   * latest), so a 240 Hz pen does not flood the IPC channel.
   */
  send(msg: PresentMessage) {
    if (!this.active) return;
    this.#queue.set(msg.kind, msg);
    if (this.#frame) return;
    this.#frame = requestAnimationFrame(() => {
      this.#frame = 0;
      const batch = [...this.#queue.values()];
      this.#queue.clear();
      for (const m of batch) emitTo(AUDIENCE, PRESENT_EVENT, m).catch(() => {});
    });
  }
}

export const presenter = new Presenter();

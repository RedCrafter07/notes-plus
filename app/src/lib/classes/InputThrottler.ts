export class InputThrottler {
  #pendingUpdate: boolean = false;
  #cancelled = false;

  cancel() {
    this.#cancelled = true;
  }

  update(callback: () => void) {
    if (this.#pendingUpdate) return;
    this.#pendingUpdate = true;
    requestAnimationFrame(() => {
      if (!this.#cancelled) callback();
      this.#cancelled = false;
      this.#pendingUpdate = false;
    });
  }
}

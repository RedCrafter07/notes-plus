import type { IconFolder } from "@tabler/icons-svelte";

/*
 * One app-wide context menu. Anything can offer one with
 * `use:contextMenu={() => items}`: it opens on right-click, and on a long
 * press with a pen or finger (which have no right button).
 */

export interface MenuItem {
  label: string;
  icon?: typeof IconFolder;
  onSelect: () => void | Promise<void>;
  /** Shown in red (delete, trash). */
  destructive?: boolean;
  disabled?: boolean;
  /** Draw a divider above this item. */
  separator?: boolean;
}

class ContextMenuState {
  menu = $state<{ x: number; y: number; title?: string; items: MenuItem[] }>();

  show(x: number, y: number, items: MenuItem[], title?: string) {
    if (items.length) this.menu = { x, y, items, title };
  }

  close() {
    this.menu = undefined;
  }
}

export const contextMenuState = new ContextMenuState();

const LONG_PRESS_MS = 500;
const MOVE_TOLERANCE = 8;

type Source = () => { items: MenuItem[]; title?: string };

export function contextMenu(node: HTMLElement, source: Source) {
  let get = source;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let start: { x: number; y: number } | undefined;
  let suppressClick = false;

  const open = (x: number, y: number) => {
    const { items, title } = get();
    contextMenuState.show(x, y, items, title);
  };

  const onContextMenu = (e: MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    open(e.clientX, e.clientY);
  };

  const cancel = () => {
    clearTimeout(timer);
    timer = undefined;
    start = undefined;
  };

  const onPointerDown = (e: PointerEvent) => {
    if (e.pointerType === "mouse") return;
    start = { x: e.clientX, y: e.clientY };
    timer = setTimeout(() => {
      timer = undefined;
      // The press ends in a click; don't let it also open the item.
      suppressClick = true;
      if (start) open(start.x, start.y);
    }, LONG_PRESS_MS);
  };

  const onPointerMove = (e: PointerEvent) => {
    if (start && Math.hypot(e.clientX - start.x, e.clientY - start.y) > MOVE_TOLERANCE) cancel();
  };

  const onClick = (e: MouseEvent) => {
    if (!suppressClick) return;
    suppressClick = false;
    e.preventDefault();
    e.stopPropagation();
  };

  node.addEventListener("contextmenu", onContextMenu);
  node.addEventListener("pointerdown", onPointerDown);
  node.addEventListener("pointermove", onPointerMove);
  node.addEventListener("pointerup", cancel);
  node.addEventListener("pointercancel", cancel);
  node.addEventListener("click", onClick, true);

  return {
    update(next: Source) {
      get = next;
    },
    destroy() {
      cancel();
      node.removeEventListener("contextmenu", onContextMenu);
      node.removeEventListener("pointerdown", onPointerDown);
      node.removeEventListener("pointermove", onPointerMove);
      node.removeEventListener("pointerup", cancel);
      node.removeEventListener("pointercancel", cancel);
      node.removeEventListener("click", onClick, true);
    },
  };
}

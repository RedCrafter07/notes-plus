import type { Page } from "#lib/tauri/bindings.ts";

/*
 * The date and time a page was added (`Page.created_at`), shown in its top
 * margin with the `page_dates` setting: the same place on screen, in
 * exports, thumbnails and the presenter view.
 */

const format = new Intl.DateTimeFormat(undefined, {
  weekday: "short",
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

/** e.g. "Thu, 27 Nov 2026, 14:43" (in the system's language); undefined without a date. */
export function pageDateLabel(page: Pick<Page, "created_at">): string | undefined {
  return page.created_at ? format.format(new Date(page.created_at)) : undefined;
}

/** Where the label sits, in content units: right-aligned in the top margin. */
export const PAGE_DATE = { right: 32, top: 30, size: 12, color: "#8c8c99" } as const;

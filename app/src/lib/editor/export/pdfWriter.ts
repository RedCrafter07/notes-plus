/*
 * A minimal PDF 1.4 writer: each page is one full-page JPEG image.
 *
 * A PDF is a list of numbered objects followed by a cross-reference table
 * holding each object's byte offset. Per page we write three objects: the
 * page, its content stream (which just paints the image), and the image
 * itself, whose JPEG bytes PDF readers decode natively (DCTDecode).
 */

export interface PdfPage {
  /** JPEG file bytes. */
  jpeg: Uint8Array;
  /** Image size in pixels. */
  pixelWidth: number;
  pixelHeight: number;
  /** Page size in PDF points (1/72 inch). */
  width: number;
  height: number;
}

export function buildPdf(pages: PdfPage[]): Uint8Array {
  const enc = new TextEncoder();
  const chunks: Uint8Array[] = [];
  const offsets: number[] = [];
  let length = 0;

  const push = (data: string | Uint8Array) => {
    const bytes = typeof data === "string" ? enc.encode(data) : data;
    chunks.push(bytes);
    length += bytes.length;
  };
  const object = (id: number, body: () => void) => {
    offsets[id] = length;
    push(`${id} 0 obj\n`);
    body();
    push("\nendobj\n");
  };
  const num = (n: number) => +n.toFixed(3);

  // Header; the binary comment tells transfer tools the file is not text.
  push("%PDF-1.4\n%\xE2\xE3\xCF\xD3\n");

  // Object ids: 1 catalog, 2 page tree, then 3 per page.
  const pageIds = pages.map((_, i) => 3 + i * 3);

  object(1, () => push("<< /Type /Catalog /Pages 2 0 R >>"));
  object(2, () =>
    push(
      `<< /Type /Pages /Count ${pages.length} /Kids [${pageIds.map((id) => `${id} 0 R`).join(" ")}] >>`,
    ),
  );

  pages.forEach((p, i) => {
    const pageId = pageIds[i];
    const contentId = pageId + 1;
    const imageId = pageId + 2;
    const w = num(p.width);
    const h = num(p.height);

    object(pageId, () =>
      push(
        `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${w} ${h}] ` +
          `/Resources << /XObject << /Im0 ${imageId} 0 R >> >> /Contents ${contentId} 0 R >>`,
      ),
    );

    // Scale the unit-square image to the page and paint it.
    const stream = `q ${w} 0 0 ${h} 0 0 cm /Im0 Do Q`;
    object(contentId, () =>
      push(`<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`),
    );

    object(imageId, () => {
      push(
        `<< /Type /XObject /Subtype /Image /Width ${p.pixelWidth} /Height ${p.pixelHeight} ` +
          `/ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${p.jpeg.length} >>\nstream\n`,
      );
      push(p.jpeg);
      push("\nendstream");
    });
  });

  const count = 3 + pages.length * 3;
  const xref = length;
  push(`xref\n0 ${count}\n0000000000 65535 f \n`);
  for (let id = 1; id < count; id++)
    push(`${String(offsets[id]).padStart(10, "0")} 00000 n \n`);
  push(`trailer\n<< /Size ${count} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`);

  const out = new Uint8Array(length);
  let at = 0;
  for (const c of chunks) {
    out.set(c, at);
    at += c.length;
  }
  return out;
}

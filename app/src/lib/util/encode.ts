/**
 * A canvas as a data URL, encoded without blocking the editor.
 *
 * `canvas.toDataURL()` compresses on the main thread: in the release build a
 * page thumbnail plus the file preview after each gesture took ~0.4 s, felt
 * as a hitch right after lifting the pen. `toBlob` encodes on a worker
 * thread; only the (small) base64 step remains, and that is async too.
 */
export async function encodeCanvas(
  canvas: HTMLCanvasElement,
  type = "image/png",
  quality?: number,
): Promise<string> {
  const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, type, quality));
  if (!blob) return canvas.toDataURL(type, quality); // e.g. a zero-size canvas
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

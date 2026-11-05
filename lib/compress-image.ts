/**
 * Shrinks a phone photo in the browser before upload so it stays small and fast
 * on mobile data. Uses WebP where the browser can encode it (Chrome/Android) and
 * JPEG elsewhere (Safari can't encode WebP from a canvas). Cloudinary serves
 * f_auto/q_auto copies anyway, so this only affects upload size. 1440px on the
 * long side is still sharper than any size the app displays (max 800px).
 * Falls back to the original file if the browser can't decode it.
 */
export async function compressImage(file: File, maxSize = 1440, quality = 0.8): Promise<File> {
  if (!file.type.startsWith("image/")) return file;
  try {
    const bitmap = await loadBitmap(file);
    const scale = Math.min(1, maxSize / Math.max(bitmap.width, bitmap.height));
    const width = Math.round(bitmap.width * scale);
    const height = Math.round(bitmap.height * scale);

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(bitmap, 0, 0, width, height);
    if ("close" in bitmap) bitmap.close();

    let blob = await toBlob(canvas, "image/webp", quality);
    // Browsers that can't encode WebP silently return PNG instead.
    if (blob?.type !== "image/webp") blob = await toBlob(canvas, "image/jpeg", quality);
    canvas.width = canvas.height = 0; // free the backing store right away on iOS
    if (!blob || blob.size >= file.size) return file;
    const ext = blob.type === "image/webp" ? ".webp" : ".jpg";
    return new File([blob], file.name.replace(/\.\w+$/, "") + ext, { type: blob.type });
  } catch {
    return file;
  }
}

function toBlob(canvas: HTMLCanvasElement, type: string, quality: number) {
  return new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, quality));
}

async function loadBitmap(file: File): Promise<ImageBitmap | HTMLImageElement> {
  if ("createImageBitmap" in window) {
    try {
      // Respects EXIF orientation so iPhone portrait shots aren't rotated.
      return await createImageBitmap(file, { imageOrientation: "from-image" });
    } catch {
      // Older Safari: fall through to <img>
    }
  }
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    return img;
  } finally {
    URL.revokeObjectURL(url);
  }
}

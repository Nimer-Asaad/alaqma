import { getUploadSignature } from "@/app/actions";

export type UploadSignature = NonNullable<Awaited<ReturnType<typeof getUploadSignature>>>;
export type UploadedImage = { url: string; publicId: string };

// Cloudinary accepts a signature for about an hour; reuse one well inside that.
const SIGNATURE_TTL_MS = 45 * 60 * 1000;
let cached: { at: number; promise: Promise<UploadSignature | null> } | null = null;

/** Fetches (or reuses) an upload signature from the server. Null when not an admin. */
export function getSignature(): Promise<UploadSignature | null> {
  if (!cached || Date.now() - cached.at > SIGNATURE_TTL_MS) {
    const promise = getUploadSignature().catch(() => null);
    cached = { at: Date.now(), promise };
    // Don't keep a failed or empty result around.
    promise.then((sig) => {
      if (!sig && cached?.promise === promise) cached = null;
    });
  }
  return cached.promise;
}

/** Uploads straight from the browser to Cloudinary, reporting progress from 0 to 1. */
export function uploadToCloudinary(
  file: File,
  sig: UploadSignature,
  onProgress: (fraction: number) => void,
  signal: AbortSignal,
): Promise<UploadedImage> {
  return new Promise((resolve, reject) => {
    const body = new FormData();
    body.set("file", file);
    body.set("api_key", sig.apiKey);
    body.set("timestamp", String(sig.timestamp));
    body.set("folder", sig.folder);
    body.set("transformation", sig.transformation);
    body.set("signature", sig.signature);

    const xhr = new XMLHttpRequest();
    xhr.open("POST", `https://api.cloudinary.com/v1_1/${sig.cloudName}/image/upload`);
    xhr.timeout = 90_000;
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress(e.loaded / e.total);
    };
    xhr.onload = () => {
      try {
        const res = JSON.parse(xhr.responseText);
        if (xhr.status === 200 && res.secure_url && res.public_id) {
          resolve({ url: res.secure_url, publicId: res.public_id });
        } else {
          reject(new Error(res.error?.message ?? `Upload failed (${xhr.status})`));
        }
      } catch {
        reject(new Error(`Upload failed (${xhr.status})`));
      }
    };
    xhr.onerror = xhr.ontimeout = () => reject(new Error("Upload network error"));
    xhr.onabort = () => reject(new DOMException("Aborted", "AbortError"));
    signal.addEventListener("abort", () => xhr.abort(), { once: true });
    xhr.send(body);
  });
}

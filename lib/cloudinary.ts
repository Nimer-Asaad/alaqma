import "server-only";
import { v2 as cloudinary, type UploadApiResponse } from "cloudinary";

let configured = false;

function client() {
  if (!configured) {
    const { CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET } = process.env;
    if (!CLOUDINARY_CLOUD_NAME || !CLOUDINARY_API_KEY || !CLOUDINARY_API_SECRET) {
      throw new Error("Cloudinary environment variables are not set");
    }
    cloudinary.config({
      cloud_name: CLOUDINARY_CLOUD_NAME,
      api_key: CLOUDINARY_API_KEY,
      api_secret: CLOUDINARY_API_SECRET,
      secure: true,
    });
    configured = true;
  }
  return cloudinary;
}

export const MAX_IMAGE_BYTES = 4 * 1024 * 1024;
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"];

export function validateImage(file: File): string | null {
  if (!ALLOWED_TYPES.includes(file.type)) return "نوع الصورة غير مدعوم";
  if (file.size > MAX_IMAGE_BYTES) return "حجم الصورة كبير جداً (الحد 4 ميغابايت)";
  return null;
}

const folder = () => process.env.CLOUDINARY_FOLDER || "alaq-products";
// Store a normalized copy; originals from phones can be huge.
const INCOMING_TRANSFORMATION = "c_limit,h_1600,w_1600";

/**
 * Signature for one direct browser -> Cloudinary upload. Only the folder and size
 * limit are signed, so the browser can't pick another folder or skip the resize.
 * The API secret never leaves the server. Valid for about an hour (Cloudinary rule).
 */
export function signUpload() {
  const cld = client();
  const config = cld.config();
  const params = {
    folder: folder(),
    timestamp: Math.round(Date.now() / 1000),
    transformation: INCOMING_TRANSFORMATION,
  };
  const signature = cld.utils.api_sign_request(params, config.api_secret!);
  return {
    ...params,
    signature,
    apiKey: config.api_key!,
    cloudName: config.cloud_name!,
  };
}

/**
 * Checks that a URL/public id pair sent by the browser points at an image in our
 * own cloud and folder, so a client can't store arbitrary URLs.
 */
export function isOwnPublicId(publicId: string): boolean {
  return /^[\w\-/]+$/.test(publicId) && publicId.startsWith(`${folder()}/`);
}

export function isOwnUpload(url: string, publicId: string): boolean {
  const cloud = client().config().cloud_name ?? "";
  if (!/^[\w-]+$/.test(cloud) || !isOwnPublicId(publicId)) return false;
  // e.g. https://res.cloudinary.com/<cloud>/image/upload/v1730000000/alaq-products/abc123.jpg
  return new RegExp(`^https://res\\.cloudinary\\.com/${cloud}/image/upload/(v\\d+/)?${publicId}\\.\\w+$`).test(url);
}

export async function uploadImage(file: File): Promise<{ url: string; publicId: string }> {
  const buffer = Buffer.from(await file.arrayBuffer());
  const result = await new Promise<UploadApiResponse>((resolve, reject) => {
    client()
      .uploader.upload_stream(
        {
          folder: folder(),
          resource_type: "image",
          transformation: INCOMING_TRANSFORMATION,
        },
        (error, res) => (error || !res ? reject(error ?? new Error("Upload failed")) : resolve(res)),
      )
      .end(buffer);
  });
  return { url: result.secure_url, publicId: result.public_id };
}

export async function deleteImage(publicId: string | null | undefined) {
  if (!publicId) return;
  try {
    await client().uploader.destroy(publicId, { invalidate: true });
  } catch (err) {
    console.error("Cloudinary delete failed", publicId, err);
  }
}

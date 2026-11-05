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

export async function uploadImage(file: File): Promise<{ url: string; publicId: string }> {
  const buffer = Buffer.from(await file.arrayBuffer());
  const result = await new Promise<UploadApiResponse>((resolve, reject) => {
    client()
      .uploader.upload_stream(
        {
          folder: process.env.CLOUDINARY_FOLDER || "alaq-products",
          resource_type: "image",
          // Store a normalized copy; originals from phones can be huge.
          transformation: [{ width: 1600, height: 1600, crop: "limit" }],
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

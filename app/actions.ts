"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { after } from "next/server";
import { createClient, getAdmin } from "@/lib/supabase/server";
import {
  deleteImage,
  isOwnPublicId,
  isOwnUpload,
  signUpload,
  uploadImage,
  validateImage,
} from "@/lib/cloudinary";
import type { FormState } from "@/lib/types";

export async function login(_prev: FormState, formData: FormData): Promise<FormState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  if (!email || !password) return { error: "أدخل البريد الإلكتروني وكلمة المرور" };

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    console.error("Login failed", { code: error.code, status: error.status, message: error.message });
    return { error: loginErrorMessage(error) };
  }

  const { data: isAdmin, error: adminError } = await supabase.rpc("is_admin");
  if (adminError) {
    console.error("is_admin check failed", adminError);
    await supabase.auth.signOut();
    return { error: "تعذّر التحقق من صلاحية المدير. تأكد من تشغيل ملف schema.sql في Supabase." };
  }
  if (!isAdmin) {
    await supabase.auth.signOut();
    return { error: "تم تسجيل الدخول، لكن هذا الحساب غير مضاف إلى جدول المدراء (admins)." };
  }
  redirect("/");
}

function loginErrorMessage(error: { code?: string; status?: number; message: string }): string {
  switch (error.code) {
    case "invalid_credentials":
      return "البريد الإلكتروني أو كلمة المرور غير صحيحة";
    case "email_not_confirmed":
      return "البريد الإلكتروني لهذا الحساب غير مؤكَّد في Supabase";
    case "user_banned":
      return "هذا الحساب موقوف في Supabase";
    case "over_request_rate_limit":
      return "محاولات كثيرة، انتظر قليلاً ثم حاول مجدداً";
  }
  // Wrong/expired project key or URL comes back without an auth error code.
  if (error.status === 401 || /api key/i.test(error.message)) {
    return "مفتاح Supabase في إعدادات Vercel غير صحيح (NEXT_PUBLIC_SUPABASE_ANON_KEY)";
  }
  if (!error.status) {
    return "تعذّر الاتصال بـ Supabase. تحقق من NEXT_PUBLIC_SUPABASE_URL في Vercel";
  }
  return `تعذّر تسجيل الدخول (${error.code ?? error.status ?? "unknown"})`;
}

export async function logout() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

type ParsedProduct = {
  name: string;
  purchase_price: number;
  wholesale_price: number;
  retail_price: number;
  quantity: number | null;
};

function parsePrice(raw: FormDataEntryValue | null): number | null {
  const text = String(raw ?? "")
    .trim()
    // Accept Arabic-Indic digits and Arabic decimal separator from the iOS keyboard
    .replace(/[٠-٩]/g, (d) => String("٠١٢٣٤٥٦٧٨٩".indexOf(d)))
    .replace(/[٫,]/g, ".");
  if (!text) return null;
  const n = Number(text);
  if (!Number.isFinite(n) || n < 0 || n > 10_000_000) return null;
  return Math.round(n * 100) / 100;
}

function parseProduct(formData: FormData): { data?: ParsedProduct; state?: FormState } {
  const fieldErrors: Record<string, string> = {};
  const name = String(formData.get("name") ?? "").trim();
  if (!name) fieldErrors.name = "اسم المنتج مطلوب";
  else if (name.length > 200) fieldErrors.name = "الاسم طويل جداً";

  const purchase = parsePrice(formData.get("purchase_price"));
  const wholesale = parsePrice(formData.get("wholesale_price"));
  const retail = parsePrice(formData.get("retail_price"));
  if (purchase == null) fieldErrors.purchase_price = "أدخل سعر جملة الجملة";
  if (wholesale == null) fieldErrors.wholesale_price = "أدخل سعر الجملة";
  if (retail == null) fieldErrors.retail_price = "أدخل سعر المفرق";

  const qtyRaw = parsePrice(formData.get("quantity"));
  const qtyText = String(formData.get("quantity") ?? "").trim();
  let quantity: number | null = null;
  if (qtyText) {
    if (qtyRaw == null || !Number.isInteger(qtyRaw)) fieldErrors.quantity = "الكمية يجب أن تكون رقماً صحيحاً";
    else quantity = qtyRaw;
  }

  if (Object.keys(fieldErrors).length) return { state: { fieldErrors } };
  return {
    data: {
      name,
      purchase_price: purchase!,
      wholesale_price: wholesale!,
      retail_price: retail!,
      quantity,
    },
  };
}

function getImage(formData: FormData): File | null {
  const file = formData.get("image");
  return file instanceof File && file.size > 0 ? file : null;
}

const SESSION_EXPIRED: FormState = { error: "انتهت الجلسة، سجّل الدخول من جديد" };

/** Postgres "insufficient privilege": RLS rejected the caller (signed out or not an admin). */
function isRlsDenied(error: { code?: string } | null) {
  return error?.code === "42501";
}

/**
 * Picks the product image from the form: an image the browser already uploaded
 * straight to Cloudinary (url + public id), or, as a fallback, the file itself,
 * uploaded from here after an explicit admin check.
 */
async function resolveImage(
  formData: FormData,
): Promise<{ image: { url: string; publicId: string } | null } | { state: FormState }> {
  const url = String(formData.get("image_url") ?? "");
  const publicId = String(formData.get("image_public_id") ?? "");
  if (url || publicId) {
    if (!isOwnUpload(url, publicId)) return { state: { error: "رابط الصورة غير صالح" } };
    return { image: { url, publicId } };
  }

  const file = getImage(formData);
  if (!file) return { image: null };
  const invalid = validateImage(file);
  if (invalid) return { state: { error: invalid } };
  // Uploading spends Cloudinary quota, so check admin before doing it.
  if (!(await getAdmin())) return { state: SESSION_EXPIRED };
  try {
    return { image: await uploadImage(file) };
  } catch (err) {
    console.error(err);
    return { state: { error: "تعذّر رفع الصورة، حاول مرة أخرى" } };
  }
}

/** Signs one direct browser upload to Cloudinary. Admin only; the API secret stays here. */
export async function getUploadSignature() {
  if (!(await getAdmin())) return null;
  return signUpload();
}

/** Deletes a direct upload the user replaced or removed before saving the product. */
export async function discardUpload(publicId: string) {
  if (!isOwnPublicId(publicId)) return;
  const admin = await getAdmin();
  if (!admin) return;
  const { count, error } = await admin.supabase
    .from("products")
    .select("id", { count: "exact", head: true })
    .eq("image_public_id", publicId);
  if (!error && count === 0) after(() => deleteImage(publicId));
}

// Product writes are authorized by RLS (only admins may insert/update/delete), so
// they don't need a separate admin round trip first. Anything that touches
// Cloudinary on the server checks admin explicitly, since RLS doesn't cover it.

export async function createProduct(formData: FormData): Promise<FormState> {
  const { data, state } = parseProduct(formData);
  if (!data) return state!;

  const resolved = await resolveImage(formData);
  if ("state" in resolved) return resolved.state;
  const { image } = resolved;

  const supabase = await createClient();
  const { error } = await supabase.from("products").insert({
    ...data,
    image_url: image?.url ?? null,
    image_public_id: image?.publicId ?? null,
  });
  if (error) {
    console.error(error);
    if (image) after(() => deleteImage(image.publicId));
    return isRlsDenied(error) ? SESSION_EXPIRED : { error: "تعذّر حفظ المنتج" };
  }

  revalidatePath("/");
  return null;
}

export async function updateProduct(id: string, formData: FormData): Promise<FormState> {
  const { data, state } = parseProduct(formData);
  if (!data) return state!;

  const resolved = await resolveImage(formData);
  if ("state" in resolved) return resolved.state;
  const { image } = resolved;
  const removeImage = !image && formData.get("remove_image") === "1";

  const supabase = await createClient();
  // The old image id is only needed when the image is replaced or removed.
  let oldPublicId: string | null = null;
  if (image || removeImage) {
    const { data: existing, error: readError } = await supabase
      .from("products")
      .select("image_public_id")
      .eq("id", id)
      .maybeSingle();
    if (readError || !existing) {
      if (image) after(() => deleteImage(image.publicId));
      return isRlsDenied(readError) ? SESSION_EXPIRED : { error: "المنتج غير موجود" };
    }
    oldPublicId = existing.image_public_id;
  }

  const update: Record<string, unknown> = { ...data };
  if (image) {
    update.image_url = image.url;
    update.image_public_id = image.publicId;
  } else if (removeImage) {
    update.image_url = null;
    update.image_public_id = null;
  }

  const { data: updated, error } = await supabase.from("products").update(update).eq("id", id).select("id");
  if (error || !updated?.length) {
    if (error) console.error(error);
    if (image) after(() => deleteImage(image.publicId));
    if (isRlsDenied(error)) return SESSION_EXPIRED;
    return { error: error ? "تعذّر حفظ التعديلات" : "المنتج غير موجود" };
  }

  if (oldPublicId && oldPublicId !== image?.publicId) {
    const stale = oldPublicId;
    after(() => deleteImage(stale));
  }

  revalidatePath("/");
  revalidatePath(`/products/${id}/edit`);
  // Redirecting from the action streams the catalog back in this same response.
  redirect("/");
}

export async function deleteProduct(id: string): Promise<FormState> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("products")
    .delete()
    .eq("id", id)
    .select("image_public_id")
    .maybeSingle();
  if (error || !data) {
    if (error) console.error(error);
    return isRlsDenied(error) ? SESSION_EXPIRED : { error: "تعذّر حذف المنتج" };
  }

  const publicId = data.image_public_id;
  after(() => deleteImage(publicId));
  revalidatePath("/");
  redirect("/");
}

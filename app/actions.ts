"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient, getAdmin } from "@/lib/supabase/server";
import { deleteImage, uploadImage, validateImage } from "@/lib/cloudinary";
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

export async function createProduct(formData: FormData): Promise<FormState> {
  const admin = await getAdmin();
  if (!admin) return { error: "انتهت الجلسة، سجّل الدخول من جديد" };

  const { data, state } = parseProduct(formData);
  if (!data) return state!;

  let image: { url: string; publicId: string } | null = null;
  const file = getImage(formData);
  if (file) {
    const invalid = validateImage(file);
    if (invalid) return { error: invalid };
    try {
      image = await uploadImage(file);
    } catch (err) {
      console.error(err);
      return { error: "تعذّر رفع الصورة، حاول مرة أخرى" };
    }
  }

  const { error } = await admin.supabase.from("products").insert({
    ...data,
    image_url: image?.url ?? null,
    image_public_id: image?.publicId ?? null,
  });
  if (error) {
    console.error(error);
    await deleteImage(image?.publicId);
    return { error: "تعذّر حفظ المنتج" };
  }

  revalidatePath("/");
  return null;
}

export async function updateProduct(id: string, formData: FormData): Promise<FormState> {
  const admin = await getAdmin();
  if (!admin) return { error: "انتهت الجلسة، سجّل الدخول من جديد" };

  const { data, state } = parseProduct(formData);
  if (!data) return state!;

  const { data: existing, error: readError } = await admin.supabase
    .from("products")
    .select("image_public_id")
    .eq("id", id)
    .single();
  if (readError || !existing) return { error: "المنتج غير موجود" };

  const update: Record<string, unknown> = { ...data };
  let uploadedId: string | null = null;
  const file = getImage(formData);
  const removeImage = formData.get("remove_image") === "1";

  if (file) {
    const invalid = validateImage(file);
    if (invalid) return { error: invalid };
    try {
      const image = await uploadImage(file);
      uploadedId = image.publicId;
      update.image_url = image.url;
      update.image_public_id = image.publicId;
    } catch (err) {
      console.error(err);
      return { error: "تعذّر رفع الصورة، حاول مرة أخرى" };
    }
  } else if (removeImage) {
    update.image_url = null;
    update.image_public_id = null;
  }

  const { error } = await admin.supabase.from("products").update(update).eq("id", id);
  if (error) {
    console.error(error);
    await deleteImage(uploadedId);
    return { error: "تعذّر حفظ التعديلات" };
  }

  if (file || removeImage) await deleteImage(existing.image_public_id);

  revalidatePath("/");
  revalidatePath(`/products/${id}/edit`);
  return null;
}

export async function deleteProduct(id: string): Promise<FormState> {
  const admin = await getAdmin();
  if (!admin) return { error: "انتهت الجلسة، سجّل الدخول من جديد" };

  const { data, error } = await admin.supabase
    .from("products")
    .delete()
    .eq("id", id)
    .select("image_public_id")
    .single();
  if (error || !data) return { error: "تعذّر حذف المنتج" };

  await deleteImage(data.image_public_id);
  revalidatePath("/");
  return null;
}

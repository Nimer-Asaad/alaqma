"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { createProduct, updateProduct } from "@/app/actions";
import { compressImage } from "@/lib/compress-image";
import { formatILS, formatPercent, profit, thumb } from "@/lib/format";
import type { FormState, Product } from "@/lib/types";

type Prices = { purchase: string; wholesale: string; retail: string };

function toNumber(value: string): number | null {
  const text = value
    .trim()
    .replace(/[٠-٩]/g, (d) => String("٠١٢٣٤٥٦٧٨٩".indexOf(d)))
    .replace(/[٫,]/g, ".");
  if (!text) return null;
  const n = Number(text);
  return Number.isFinite(n) ? n : null;
}

export default function ProductForm({ product }: { product?: Product }) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);
  const [pending, startTransition] = useTransition();
  const [state, setState] = useState<FormState>(null);
  const [saved, setSaved] = useState(0);

  const [image, setImage] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(thumb(product?.image_url, 800));
  const [removeImage, setRemoveImage] = useState(false);
  const [preparing, setPreparing] = useState(false);

  const [prices, setPrices] = useState<Prices>({
    purchase: product ? String(product.purchase_price) : "",
    wholesale: product ? String(product.wholesale_price) : "",
    retail: product ? String(product.retail_price) : "",
  });

  useEffect(() => {
    return () => {
      if (preview?.startsWith("blob:")) URL.revokeObjectURL(preview);
    };
  }, [preview]);

  async function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setPreparing(true);
    const compressed = await compressImage(file);
    setPreparing(false);
    setImage(compressed);
    setRemoveImage(false);
    setPreview(URL.createObjectURL(compressed));
  }

  function clearImage() {
    setImage(null);
    setPreview(null);
    setRemoveImage(true);
  }

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    if (image) formData.set("image", image);
    if (removeImage && !image) formData.set("remove_image", "1");

    startTransition(async () => {
      const result = product ? await updateProduct(product.id, formData) : await createProduct(formData);
      setState(result);
      if (result) return;
      if (product) {
        router.push("/");
        router.refresh();
        return;
      }
      // Stay on the page for fast back-to-back entry of supplier products.
      formRef.current?.reset();
      setPrices({ purchase: "", wholesale: "", retail: "" });
      setImage(null);
      setPreview(null);
      setRemoveImage(false);
      setSaved((n) => n + 1);
      window.scrollTo({ top: 0, behavior: "smooth" });
    });
  }

  useEffect(() => {
    if (!saved) return;
    const t = setTimeout(() => setSaved(0), 2500);
    return () => clearTimeout(t);
  }, [saved]);

  const purchase = toNumber(prices.purchase);
  const wholesale = toNumber(prices.wholesale);
  const retail = toNumber(prices.retail);
  const fe = state?.fieldErrors ?? {};

  return (
    <form ref={formRef} onSubmit={onSubmit} className="space-y-5" noValidate>
      {saved > 0 && (
        <div className="fixed inset-x-4 top-[calc(4rem+env(safe-area-inset-top))] z-40 mx-auto max-w-sm rounded-xl bg-emerald-600 px-4 py-3 text-center font-semibold text-white shadow-lg">
          ✓ تم حفظ المنتج
        </div>
      )}

      {/* Image */}
      <section>
        <div className="relative aspect-square w-full overflow-hidden rounded-2xl bg-slate-100 ring-1 ring-slate-200">
          {preview ? (
            <>
              <img src={preview} alt="" className="h-full w-full object-contain" />
              <button
                type="button"
                onClick={clearImage}
                className="absolute end-3 top-3 rounded-full bg-black/60 px-3 py-1.5 text-sm text-white"
              >
                إزالة
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={() => cameraRef.current?.click()}
              className="flex h-full w-full flex-col items-center justify-center gap-2 text-slate-500"
            >
              <CameraIcon className="h-14 w-14" />
              <span className="font-medium">اضغط لتصوير المنتج</span>
            </button>
          )}
          {preparing && (
            <div className="absolute inset-0 flex items-center justify-center bg-white/70 font-medium">
              جارٍ تجهيز الصورة…
            </div>
          )}
        </div>
        <div className="mt-3 grid grid-cols-2 gap-3">
          <button type="button" onClick={() => cameraRef.current?.click()} className="btn-secondary">
            <CameraIcon className="h-5 w-5" /> الكاميرا
          </button>
          <button type="button" onClick={() => galleryRef.current?.click()} className="btn-secondary">
            <GalleryIcon className="h-5 w-5" /> المعرض
          </button>
        </div>
        <input ref={cameraRef} type="file" accept="image/*" capture="environment" hidden onChange={onPick} />
        <input ref={galleryRef} type="file" accept="image/*" hidden onChange={onPick} />
      </section>

      {/* Name */}
      <Field label="اسم المنتج" error={fe.name}>
        <input
          name="name"
          defaultValue={product?.name}
          required
          maxLength={200}
          autoComplete="off"
          enterKeyHint="next"
          className="input"
          placeholder="مثال: شاحن سامسونج 25 واط"
        />
      </Field>

      {/* Prices */}
      <section className="space-y-4 rounded-2xl bg-white p-4 ring-1 ring-slate-200">
        <PriceField
          name="purchase_price"
          label="سعر الشراء (جملة الجملة)"
          hint="سعر المورّد"
          value={prices.purchase}
          onChange={(v) => setPrices((p) => ({ ...p, purchase: v }))}
          error={fe.purchase_price}
        />
        <PriceField
          name="wholesale_price"
          label="سعر البيع جملة"
          value={prices.wholesale}
          onChange={(v) => setPrices((p) => ({ ...p, wholesale: v }))}
          error={fe.wholesale_price}
        />
        <PriceField
          name="retail_price"
          label="سعر البيع مفرق"
          value={prices.retail}
          onChange={(v) => setPrices((p) => ({ ...p, retail: v }))}
          error={fe.retail_price}
        />

        <div className="grid grid-cols-2 gap-3 border-t border-slate-100 pt-4">
          <ProfitBox label="ربح الجملة" sale={wholesale} purchase={purchase} />
          <ProfitBox label="ربح المفرق" sale={retail} purchase={purchase} />
        </div>
      </section>

      <Field label="الكمية (اختياري)" error={fe.quantity}>
        <input
          name="quantity"
          defaultValue={product?.quantity ?? ""}
          inputMode="numeric"
          pattern="[0-9]*"
          autoComplete="off"
          className="input"
          placeholder="0"
          dir="ltr"
        />
      </Field>

      {state?.error && <p className="rounded-xl bg-red-50 p-3 text-red-700">{state.error}</p>}

      <div className="sticky bottom-0 -mx-4 flex gap-3 border-t border-slate-200 bg-white/95 px-4 pt-3 pb-safe backdrop-blur">
        <button type="submit" disabled={pending || preparing} className="btn-primary flex-1 text-lg">
          {pending ? "جارٍ الحفظ…" : product ? "حفظ التعديلات" : "حفظ المنتج"}
        </button>
        {!product && (
          <Link href="/" className="btn-secondary">
            الكتالوج
          </Link>
        )}
      </div>
    </form>
  );
}

function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium text-slate-700">{label}</span>
      {children}
      {error && <span className="mt-1 block text-sm text-red-600">{error}</span>}
    </label>
  );
}

function PriceField({
  name,
  label,
  hint,
  value,
  onChange,
  error,
}: {
  name: string;
  label: string;
  hint?: string;
  value: string;
  onChange: (v: string) => void;
  error?: string;
}) {
  return (
    <label className="block">
      <span className="mb-1 flex items-baseline justify-between text-sm font-medium text-slate-700">
        {label}
        {hint && <span className="text-xs font-normal text-slate-400">{hint}</span>}
      </span>
      <div className="relative">
        <input
          name={name}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          inputMode="decimal"
          autoComplete="off"
          enterKeyHint="next"
          className="input pe-10 text-lg font-semibold"
          placeholder="0.00"
          dir="ltr"
        />
        <span className="pointer-events-none absolute end-3 top-1/2 -translate-y-1/2 text-slate-400">₪</span>
      </div>
      {error && <span className="mt-1 block text-sm text-red-600">{error}</span>}
    </label>
  );
}

function ProfitBox({ label, sale, purchase }: { label: string; sale: number | null; purchase: number | null }) {
  const ready = sale != null && purchase != null;
  const p = ready ? profit(sale, purchase) : null;
  const tone = !p ? "text-slate-400" : p.amount >= 0 ? "text-emerald-700" : "text-red-600";
  return (
    <div className="rounded-xl bg-slate-50 p-3 text-center">
      <p className="text-xs text-slate-500">{label}</p>
      <p className={`mt-1 text-lg font-bold ${tone}`}>{p ? formatILS(p.amount) : "—"}</p>
      <p className={`text-xs ${tone}`}>{p ? formatPercent(p.margin) : " "}</p>
    </div>
  );
}

function CameraIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.8">
      <path
        d="M4 8h3l2-3h6l2 3h3a1 1 0 011 1v10a1 1 0 01-1 1H4a1 1 0 01-1-1V9a1 1 0 011-1z"
        strokeLinejoin="round"
      />
      <circle cx="12" cy="13.5" r="3.5" />
    </svg>
  );
}

function GalleryIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.8">
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <circle cx="9" cy="10" r="2" />
      <path d="M21 16l-5-5-9 9" strokeLinejoin="round" />
    </svg>
  );
}

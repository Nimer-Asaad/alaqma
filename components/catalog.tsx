"use client";

import Link from "next/link";
import { useDeferredValue, useMemo, useState } from "react";
import { formatILS, formatPercent, profit, thumb } from "@/lib/format";
import { normalizeArabic } from "@/lib/search";
import type { Product } from "@/lib/types";

type Sort = "newest" | "name" | "wholesale_profit" | "retail_profit";

export default function Catalog({ products }: { products: Product[] }) {
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<Sort>("newest");
  const deferredQuery = useDeferredValue(query);

  const indexed = useMemo(
    () => products.map((p) => ({ p, key: normalizeArabic(p.name) })),
    [products],
  );

  const visible = useMemo(() => {
    const terms = normalizeArabic(deferredQuery).split(" ").filter(Boolean);
    const list = terms.length
      ? indexed.filter(({ key }) => terms.every((t) => key.includes(t))).map(({ p }) => p)
      : products.slice();
    if (sort === "name") list.sort((a, b) => a.name.localeCompare(b.name, "ar"));
    if (sort === "wholesale_profit") list.sort((a, b) => b.wholesale_profit - a.wholesale_profit);
    if (sort === "retail_profit") list.sort((a, b) => b.retail_profit - a.retail_profit);
    return list;
  }, [indexed, products, deferredQuery, sort]);

  const stockValue = useMemo(
    () => products.reduce((sum, p) => sum + (p.quantity ?? 0) * p.purchase_price, 0),
    [products],
  );

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <Stat label="عدد المنتجات" value={products.length.toLocaleString("en-US")} />
        <Stat label="قيمة المخزون (شراء)" value={formatILS(stockValue)} />
      </div>

      <div className="sticky top-[calc(3.5rem+env(safe-area-inset-top))] z-10 -mx-4 space-y-2 bg-slate-50/95 px-4 py-2 backdrop-blur">
        <div className="relative">
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="ابحث باسم المنتج…"
            className="input ps-10"
            enterKeyHint="search"
          />
          <svg
            viewBox="0 0 24 24"
            className="pointer-events-none absolute start-3 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <circle cx="11" cy="11" r="7" />
            <path d="M20 20l-3.5-3.5" strokeLinecap="round" />
          </svg>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as Sort)}
            className="input flex-1 py-2"
            aria-label="ترتيب"
          >
            <option value="newest">الأحدث</option>
            <option value="name">الاسم</option>
            <option value="wholesale_profit">أعلى ربح جملة</option>
            <option value="retail_profit">أعلى ربح مفرق</option>
          </select>
          <a href="/api/export" className="btn-secondary py-2 text-sm" download>
            تصدير CSV
          </a>
        </div>
        {deferredQuery && <p className="text-sm text-slate-500">{visible.length} نتيجة</p>}
      </div>

      {visible.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 p-10 text-center text-slate-500">
          {products.length === 0 ? "لا توجد منتجات بعد. ابدأ بإضافة أول منتج." : "لا توجد نتائج مطابقة."}
        </div>
      ) : (
        <ul className="space-y-3">
          {visible.map((p) => (
            <ProductCard key={p.id} product={p} />
          ))}
        </ul>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-white p-3 ring-1 ring-slate-200">
      <p className="text-xs text-slate-500">{label}</p>
      <p className="mt-1 text-lg font-bold">{value}</p>
    </div>
  );
}

function ProductCard({ product: p }: { product: Product }) {
  const w = profit(p.wholesale_price, p.purchase_price);
  const r = profit(p.retail_price, p.purchase_price);
  const src = thumb(p.image_url, 240);
  return (
    <li>
      <Link
        href={`/products/${p.id}/edit`}
        className="flex gap-3 rounded-2xl bg-white p-3 ring-1 ring-slate-200 transition active:bg-slate-50"
      >
        <div className="h-24 w-24 shrink-0 overflow-hidden rounded-xl bg-slate-100">
          {src ? (
            <img src={src} alt={p.name} loading="lazy" decoding="async" className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full items-center justify-center text-xs text-slate-400">بدون صورة</div>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <h2 className="line-clamp-2 font-semibold leading-snug">{p.name}</h2>
            {p.quantity != null && (
              <span className="shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600">
                الكمية {p.quantity}
              </span>
            )}
          </div>
          <dl className="mt-2 grid grid-cols-3 gap-1 text-center text-xs">
            <Price label="جملة الجملة" value={p.purchase_price} />
            <Price label="جملة" value={p.wholesale_price} profit={w} />
            <Price label="مفرق" value={p.retail_price} profit={r} />
          </dl>
        </div>
      </Link>
    </li>
  );
}

function Price({
  label,
  value,
  profit: pr,
}: {
  label: string;
  value: number;
  profit?: { amount: number; margin: number };
}) {
  return (
    <div className="rounded-lg bg-slate-50 px-1 py-1.5">
      <dt className="text-slate-500">{label}</dt>
      <dd className="font-bold text-slate-900">{formatILS(value)}</dd>
      {pr && (
        <dd className={pr.amount >= 0 ? "text-emerald-700" : "text-red-600"}>
          {formatILS(pr.amount)}
          <span className="block text-[10px] opacity-80">{formatPercent(pr.margin)}</span>
        </dd>
      )}
    </div>
  );
}

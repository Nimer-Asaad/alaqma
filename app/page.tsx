import Link from "next/link";
import Header from "@/components/header";
import Catalog from "@/components/catalog";
import { createClient, getAdmin } from "@/lib/supabase/server";
import { logout } from "@/app/actions";
import { toProduct } from "@/lib/types";

export const dynamic = "force-dynamic";

// Columns the catalog actually renders.
const LIST_COLUMNS =
  "id,name,purchase_price,wholesale_price,retail_price,quantity,wholesale_profit,retail_profit,image_url,created_at";

export default async function HomePage() {
  // Admin check and product query run in parallel (one round trip). RLS returns no
  // rows to non-admins, so the query can't leak anything before the check resolves.
  const supabase = await createClient();
  const [admin, { data, error }] = await Promise.all([
    getAdmin(),
    supabase
      .from("products")
      .select(LIST_COLUMNS)
      .order("created_at", { ascending: false })
      .limit(5000),
  ]);
  if (!admin) {
    return (
      <main className="flex min-h-dvh flex-col items-center justify-center gap-4 px-4 text-center">
        <p className="text-lg">هذا الحساب لا يملك صلاحية المدير.</p>
        <form action={logout}>
          <button className="btn-secondary">تسجيل الخروج</button>
        </form>
      </main>
    );
  }

  const products = (data ?? []).map(toProduct);

  return (
    <>
      <Header title="مخزون الجملة" />
      <main className="mx-auto max-w-3xl px-4 pb-28 pt-4">
        {error ? (
          <p className="rounded-xl bg-red-50 p-4 text-red-700">تعذّر تحميل المنتجات: {error.message}</p>
        ) : (
          <Catalog products={products} />
        )}
      </main>
      <div
        className="pointer-events-none fixed inset-x-0 bottom-0 z-30 flex justify-center pb-6"
        style={{ paddingBottom: "max(1.5rem, env(safe-area-inset-bottom))" }}
      >
        <Link
          href="/products/new"
          className="btn-primary pointer-events-auto rounded-full px-6 py-4 text-lg shadow-lg shadow-brand-700/30"
        >
          <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M12 5v14M5 12h14" strokeLinecap="round" />
          </svg>
          منتج جديد
        </Link>
      </div>
    </>
  );
}

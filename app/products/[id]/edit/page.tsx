import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import Header from "@/components/header";
import ProductForm from "@/components/product-form";
import DeleteButton from "@/components/delete-button";
import { createClient, getAdmin } from "@/lib/supabase/server";
import { toProduct } from "@/lib/types";

export const metadata: Metadata = { title: "تعديل المنتج" };

export default async function EditProductPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  // Parallel, as on the home page: RLS hides rows from non-admins.
  const supabase = await createClient();
  const [admin, { data }] = await Promise.all([
    getAdmin(),
    supabase.from("products").select("*").eq("id", id).maybeSingle(),
  ]);
  if (!admin) redirect("/");
  if (!data) notFound();
  const product = toProduct(data);

  return (
    <>
      <Header title="تعديل المنتج" back />
      <main className="mx-auto max-w-xl px-4 pt-4">
        <ProductForm product={product} />
        <div className="mt-8 border-t border-slate-200 pt-6 pb-10">
          <DeleteButton id={product.id} name={product.name} />
        </div>
      </main>
    </>
  );
}

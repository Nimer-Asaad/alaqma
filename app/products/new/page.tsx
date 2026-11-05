import type { Metadata } from "next";
import Header from "@/components/header";
import ProductForm from "@/components/product-form";

export const metadata: Metadata = { title: "منتج جديد" };

export default function NewProductPage() {
  return (
    <>
      <Header title="منتج جديد" back />
      <main className="mx-auto max-w-xl px-4 pt-4">
        <ProductForm />
      </main>
    </>
  );
}

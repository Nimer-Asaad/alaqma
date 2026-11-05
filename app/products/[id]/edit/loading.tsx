import Header from "@/components/header";

// Shown instantly when a product is tapped, while its data loads.
export default function Loading() {
  return (
    <>
      <Header title="تعديل المنتج" back />
      <main className="mx-auto max-w-xl animate-pulse space-y-5 px-4 pt-4" aria-busy="true" aria-label="جارٍ التحميل">
        <div className="aspect-square w-full rounded-2xl bg-slate-100 ring-1 ring-slate-200" />
        <div className="grid grid-cols-2 gap-3">
          <div className="h-12 rounded-xl bg-slate-200" />
          <div className="h-12 rounded-xl bg-slate-200" />
        </div>
        <div className="h-12 rounded-xl bg-slate-200" />
        <div className="h-64 rounded-2xl bg-white ring-1 ring-slate-200" />
      </main>
    </>
  );
}

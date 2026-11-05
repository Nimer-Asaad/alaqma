import Header from "@/components/header";

// Shown instantly while the catalog loads, so navigation never feels stuck.
export default function Loading() {
  return (
    <>
      <Header title="مخزون الجملة" />
      <main className="mx-auto max-w-3xl animate-pulse px-4 pb-28 pt-4" aria-busy="true" aria-label="جارٍ التحميل">
        <div className="grid grid-cols-2 gap-3">
          <div className="h-[4.5rem] rounded-2xl bg-white ring-1 ring-slate-200" />
          <div className="h-[4.5rem] rounded-2xl bg-white ring-1 ring-slate-200" />
        </div>
        <div className="mt-6 h-12 rounded-xl bg-slate-200" />
        <div className="mt-2 h-10 rounded-xl bg-slate-200" />
        <ul className="mt-4 space-y-3">
          {Array.from({ length: 6 }, (_, i) => (
            <li key={i} className="flex gap-3 rounded-2xl bg-white p-3 ring-1 ring-slate-200">
              <div className="h-24 w-24 shrink-0 rounded-xl bg-slate-100" />
              <div className="flex-1 space-y-3 py-1">
                <div className="h-4 w-2/3 rounded bg-slate-100" />
                <div className="grid grid-cols-3 gap-1">
                  <div className="h-12 rounded-lg bg-slate-100" />
                  <div className="h-12 rounded-lg bg-slate-100" />
                  <div className="h-12 rounded-lg bg-slate-100" />
                </div>
              </div>
            </li>
          ))}
        </ul>
      </main>
    </>
  );
}

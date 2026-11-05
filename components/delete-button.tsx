"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { deleteProduct } from "@/app/actions";

export default function DeleteButton({ id, name }: { id: string; name: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function onDelete() {
    if (!window.confirm(`حذف "${name}" نهائياً؟`)) return;
    startTransition(async () => {
      const result = await deleteProduct(id);
      if (result?.error) {
        setError(result.error);
        return;
      }
      router.push("/");
      router.refresh();
    });
  }

  return (
    <div>
      <button type="button" onClick={onDelete} disabled={pending} className="btn-danger w-full">
        {pending ? "جارٍ الحذف…" : "حذف المنتج"}
      </button>
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
    </div>
  );
}

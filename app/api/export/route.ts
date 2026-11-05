import { NextResponse } from "next/server";
import { getAdmin } from "@/lib/supabase/server";
import { toProduct } from "@/lib/types";

export const dynamic = "force-dynamic";

function cell(value: unknown): string {
  if (value == null) return "";
  let text = String(value);
  // Neutralize spreadsheet formula injection
  if (/^[=+\-@\t\r]/.test(text) && Number.isNaN(Number(text))) text = `'${text}`;
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export async function GET() {
  const admin = await getAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data, error } = await admin.supabase
    .from("products")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const header = [
    "اسم المنتج",
    "جملة الجملة (شراء)",
    "جملة",
    "مفرق",
    "ربح الجملة",
    "ربح المفرق",
    "الكمية",
    "العملة",
    "رابط الصورة",
    "تاريخ الإضافة",
  ];
  const rows = (data ?? []).map(toProduct).map((p) => [
    p.name,
    p.purchase_price.toFixed(2),
    p.wholesale_price.toFixed(2),
    p.retail_price.toFixed(2),
    p.wholesale_profit.toFixed(2),
    p.retail_profit.toFixed(2),
    p.quantity ?? "",
    "ILS",
    p.image_url ?? "",
    new Date(p.created_at).toISOString().slice(0, 10),
  ]);

  // BOM so Excel opens Arabic text as UTF-8
  const csv = "﻿" + [header, ...rows].map((r) => r.map(cell).join(",")).join("\r\n");
  const date = new Date().toISOString().slice(0, 10);

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="products-${date}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}

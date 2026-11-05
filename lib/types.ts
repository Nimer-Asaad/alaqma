export type Product = {
  id: string;
  name: string;
  purchase_price: number;
  wholesale_price: number;
  retail_price: number;
  quantity: number | null;
  wholesale_profit: number;
  retail_profit: number;
  image_url: string | null;
  image_public_id: string | null;
  created_at: string;
  updated_at: string;
};

export type FormState = { error?: string; fieldErrors?: Record<string, string> } | null;

/** Postgres numeric can arrive as a string; coerce price fields to numbers. */
export function toProduct(row: Record<string, unknown>): Product {
  const p = row as unknown as Product;
  return {
    ...p,
    purchase_price: Number(p.purchase_price),
    wholesale_price: Number(p.wholesale_price),
    retail_price: Number(p.retail_price),
    wholesale_profit: Number(p.wholesale_profit),
    retail_profit: Number(p.retail_profit),
    quantity: p.quantity == null ? null : Number(p.quantity),
  };
}

const currency = new Intl.NumberFormat("ar-u-nu-latn", {
  style: "currency",
  currency: "ILS",
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});

export function formatILS(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return "—";
  return currency.format(value);
}

export function profit(sale: number, purchase: number) {
  const amount = Math.round((sale - purchase) * 100) / 100;
  const margin = sale > 0 ? (amount / sale) * 100 : 0;
  return { amount, margin };
}

export function formatPercent(value: number): string {
  return `${value.toFixed(1)}%`;
}

/** Cloudinary delivery URL resized for thumbnails, auto format/quality. */
export function thumb(url: string | null | undefined, width = 400): string | null {
  if (!url) return null;
  return url.replace("/upload/", `/upload/c_limit,w_${width},f_auto,q_auto/`);
}

/** Square, cropped Cloudinary thumbnail (matches an object-cover box), auto format/quality. */
export function squareThumb(url: string | null | undefined, size: number): string | null {
  if (!url) return null;
  return url.replace("/upload/", `/upload/c_fill,w_${size},h_${size},f_auto,q_auto/`);
}

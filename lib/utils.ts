export const RESTAURANT_NAME = "مطعم الذواقة";

export const CURRENCY = process.env.CURRENCY ?? "دج";

export function formatPrice(cents: number): string {
  return `${(cents / 100).toFixed(2)} ${CURRENCY}`;
}

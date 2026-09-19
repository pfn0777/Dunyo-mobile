/** Rounds ((oldPrice - price) / oldPrice) * 100, per spec's `-N%` badge rule. */
export function discountPercent(price: number, oldPrice: number | null): number | null {
  if (oldPrice === null || oldPrice <= 0) return null;
  return Math.round(((oldPrice - price) / oldPrice) * 100);
}

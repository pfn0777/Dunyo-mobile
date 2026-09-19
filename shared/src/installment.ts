/**
 * 0-0-12: an ESTIMATE shown next to a price. It is not a loan offer and creates
 * no financial obligation — the real terms come from the nasiya partner.
 */
export const INSTALLMENT_MIN_PRICE = 1_000_000;

/**
 * Computes the estimated monthly installment figure shown next to a price.
 * Returns null when the row shouldn't show an installment estimate at all:
 * a non-positive/non-finite `months`, a non-finite `price`, or a price below
 * `INSTALLMENT_MIN_PRICE` (nasiya makes no sense on a cheap accessory).
 */
export function installmentMonthly(price: number, months: number): number | null {
  if (!Number.isFinite(price) || !Number.isFinite(months)) {
    return null;
  }
  if (months <= 0) {
    return null;
  }
  if (price < INSTALLMENT_MIN_PRICE) {
    return null;
  }
  return Math.floor(price / months / 1000) * 1000;
}

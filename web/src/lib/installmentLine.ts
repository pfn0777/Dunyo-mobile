// Pure decision for <InstallmentLine>, extracted so the render/no-render
// branch is unit-testable without mounting React (per spec: "as a pure
// helper, not a render test").

import { installmentMonthly } from '../../../shared/src/installment.ts';

export interface InstallmentLineDecision {
  monthly: number;
  months: number;
}

/** Returns null when the row must not render at all — installmentMonthly
 * returned null (non-finite price/months, months<=0, or price below
 * INSTALLMENT_MIN_PRICE). Otherwise the monthly estimate to show. */
export function decideInstallmentLine(price: number, months: number): InstallmentLineDecision | null {
  const monthly = installmentMonthly(price, months);
  if (monthly === null) {
    return null;
  }
  return { monthly, months };
}

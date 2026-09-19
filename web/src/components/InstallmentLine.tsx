import { decideInstallmentLine } from '../lib/installmentLine.ts';
import { formatSom } from '../lib/format.ts';
import { useSettings } from '../lib/queries.ts';
import { t } from '../lib/i18n.ts';

/**
 * "<sum> so'm/oy" installment estimate with the 0-0-N badge. Renders nothing
 * when decideInstallmentLine() returns null (cheap accessory, e.g. a
 * charging cable under INSTALLMENT_MIN_PRICE). Always carries the
 * "taxminiy" (approximate) word — this is an ESTIMATE, never an offer; the
 * full nasiya-partner disclaimer lives on the Checkout page next to the
 * 0-0-12 payment option.
 */
export function InstallmentLine({ price, className = '' }: { price: number; className?: string }): JSX.Element | null {
  const { data: settings } = useSettings();
  const months = settings?.installment_months ?? 12;
  const decision = decideInstallmentLine(price, months);
  if (decision === null) {
    return null;
  }
  return (
    <div className={`flex items-center gap-1 flex-wrap ${className}`}>
      <span className="px-1.5 py-0.5 rounded bg-secondary/15 text-secondary font-price-badge text-price-badge uppercase tracking-wide">
        0-0-{decision.months}
      </span>
      <span className="text-label-md font-label-md text-on-surface-variant">
        {t('installment.approx')} {formatSom(decision.monthly)}/{t('installment.perMonth')}
      </span>
    </div>
  );
}

import { useNavigate } from 'react-router-dom';
import { useCartLines } from '../lib/useCart.ts';
import { formatSom } from '../lib/format.ts';
import { t } from '../lib/i18n.ts';

/** Sticky floating cart summary pill shown above the bottom nav once the
 * cart has items, per design/stitch/{catalog,products}.png. */
export function FloatingCartPill(): JSX.Element | null {
  const navigate = useNavigate();
  const lines = useCartLines();
  if (lines.length === 0) return null;

  const count = lines.reduce((sum, l) => sum + l.qty, 0);
  const total = lines.reduce((sum, l) => sum + l.price * l.qty, 0);
  const firstLine = lines[0];

  return (
    <div className="fixed bottom-16 left-0 right-0 z-30 px-margin pb-space-sm">
      <button
        type="button"
        onClick={() => navigate('/cart')}
        className="w-full flex items-center justify-between gap-space-sm bg-inverse-surface text-inverse-on-surface rounded-2xl pl-space-sm pr-space-md py-space-sm shadow-lg"
      >
        <span className="flex items-center gap-space-sm min-w-0">
          <span className="relative w-9 h-9 rounded-xl bg-white/15 flex items-center justify-center flex-shrink-0">
            <span className="material-symbols-outlined text-[20px]">shopping_bag</span>
            <span className="absolute -top-1.5 -right-1.5 min-w-[16px] h-4 px-1 rounded-full bg-primary text-on-primary text-[10px] leading-4 text-center">
              {count}
            </span>
          </span>
          <span className="flex flex-col items-start min-w-0 text-left">
            <span className="text-label-lg font-label-lg whitespace-nowrap">{formatSom(total)}</span>
            {firstLine !== undefined && (
              <span className="text-label-sm font-label-sm text-inverse-on-surface/70 truncate max-w-[140px]">
                {firstLine.name}
              </span>
            )}
          </span>
        </span>
        <span className="flex items-center gap-1 text-label-lg font-label-lg flex-shrink-0">
          {t('cart.title')}
          <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
        </span>
      </button>
    </div>
  );
}

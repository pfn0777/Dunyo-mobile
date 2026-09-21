import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCartLines } from '../lib/useCart.ts';
import { cartStore } from '../lib/cart.ts';
import { useRegions, useSettings } from '../lib/queries.ts';
import { useSelectedRegionId } from '../lib/region.ts';
import { getClient } from '../lib/client.ts';
import { formatSom } from '../lib/format.ts';
import { installmentMonthly } from '../../../shared/src/installment.ts';
import { PriceTag } from '../components/PriceTag.tsx';
import { t } from '../lib/i18n.ts';

// Per spec: summary block plus a "yoki X so'm/oy (12 oy)" taxminiy line for
// the grand total. No promo-code block (XUMO never had one; v2 exclusion
// list item "Promokod / vaucher" applies to Dunyo too).
export function Cart(): JSX.Element {
  const navigate = useNavigate();
  const lines = useCartLines();
  const { data: settings } = useSettings();
  const { data: regions } = useRegions();
  const selectedRegionId = useSelectedRegionId();
  const [reconcileNotice, setReconcileNotice] = useState<{ price: boolean; stock: boolean } | null>(null);
  const [clearConfirmOpen, setClearConfirmOpen] = useState(false);

  useEffect(() => {
    if (lines.length === 0) return;
    let cancelled = false;
    void (async () => {
      const client = await getClient();
      const productIds = [...new Set(lines.map((l) => l.productId))];
      const details = await Promise.all(productIds.map((id) => client.getProductById(id).catch(() => null)));
      if (cancelled) return;
      const freshVariants = details
        .filter((d): d is NonNullable<typeof d> => d !== null)
        .flatMap((d) => d.variants.map((v) => ({ id: v.id, price: v.price, oldPrice: v.old_price, stock: v.stock })));
      const result = cartStore.reconcile(freshVariants);
      if (result.priceChanged.length > 0 || result.stockChanged.length > 0) {
        setReconcileNotice({ price: result.priceChanged.length > 0, stock: result.stockChanged.length > 0 });
      }
    })();
    return () => {
      cancelled = true;
    };
    // Runs once on mount to refresh prices/stock before showing totals.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const region = regions?.find((r) => r.id === selectedRegionId) ?? null;
  const totals =
    settings !== undefined
      ? cartStore.totals(
          {
            regionDeliveryFee: region?.delivery_fee ?? 0,
            freeDeliveryThreshold: settings.free_delivery_threshold,
            regionFreeThreshold: region?.free_delivery_threshold ?? null,
            minOrderAmount: settings.min_order_amount,
            deliveryEnabled: settings.delivery_enabled,
          },
          'delivery',
        )
      : null;

  const installmentEstimate =
    settings !== undefined && totals !== null ? installmentMonthly(totals.grandTotal, settings.installment_months) : null;

  return (
    <div className="flex flex-col min-h-screen pb-32">
      <header className="sticky top-0 z-30 bg-surface/90 backdrop-blur-xl pt-safe px-margin h-14 flex items-center justify-between shadow-sm">
        <span className="flex items-center gap-space-xs">
          <h1 className="text-headline-md font-headline-md text-on-surface">{t('cart.title')}</h1>
          {lines.length > 0 && (
            <span className="px-2 py-0.5 rounded-full bg-secondary/15 text-secondary text-label-sm font-label-sm">
              {t('home.categoriesCount', { count: lines.length })}
            </span>
          )}
        </span>
        {lines.length > 0 && (
          <button type="button" onClick={() => setClearConfirmOpen(true)} className="text-label-lg font-label-lg text-error min-h-[44px]">
            {t('cart.clear')}
          </button>
        )}
      </header>

      <main className="px-margin pt-space-md flex flex-col gap-space-md">
        {reconcileNotice !== null && (
          <div className="bg-tertiary/15 text-tertiary text-body-sm font-body-sm rounded-xl px-space-md py-space-sm">
            {reconcileNotice.price && <p>{t('cart.priceChanged')}</p>}
            {reconcileNotice.stock && <p>{t('cart.stockChanged')}</p>}
          </div>
        )}

        {lines.length === 0 ? (
          <div className="flex flex-col items-center text-center gap-space-sm py-space-xl">
            <span className="material-symbols-outlined text-[40px] text-on-surface-variant">shopping_cart</span>
            <p className="text-body-lg font-body-lg text-on-surface font-semibold">{t('cart.empty.title')}</p>
            <p className="text-body-sm font-body-sm text-on-surface-variant">{t('cart.empty.text')}</p>
            <button
              type="button"
              onClick={() => navigate('/catalog')}
              className="min-h-[44px] px-space-lg rounded-full bg-primary text-on-primary text-label-lg font-label-lg"
            >
              {t('cart.empty.cta')}
            </button>
          </div>
        ) : (
          <>
            <div className="flex flex-col gap-space-sm">
              {lines.map((line) => (
                <div key={line.variantId} className="flex items-center gap-space-sm bg-surface-container rounded-xl p-space-sm shadow-sm">
                  <div className="w-16 h-16 rounded-lg bg-surface-container-high flex-shrink-0 overflow-hidden">
                    {line.thumb !== null && <img src={line.thumb} alt={line.name} className="w-full h-full object-cover" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-body-md font-body-md text-on-surface line-clamp-2">{line.name}</p>
                    <p className="text-label-sm font-label-sm text-on-surface-variant">
                      {line.colorName}
                      {line.storageGb !== null ? ` · ${line.storageGb} GB` : ''}
                    </p>
                    <PriceTag price={line.price} oldPrice={line.oldPrice} />
                  </div>
                  <div className="flex flex-col items-end gap-space-xs">
                    <button
                      type="button"
                      aria-label={t('common.close')}
                      onClick={() => cartStore.remove(line.variantId)}
                      className="w-8 h-8 flex items-center justify-center text-on-surface-variant"
                    >
                      <span className="material-symbols-outlined text-[18px]">delete</span>
                    </button>
                    <div className="flex items-center h-9 rounded-full bg-surface-container-high">
                      <button
                        type="button"
                        aria-label="Kamaytirish"
                        className="w-9 h-9 flex items-center justify-center"
                        onClick={() => cartStore.setQty(line.variantId, line.qty - 1)}
                      >
                        -
                      </button>
                      <span className="w-6 text-center text-label-lg font-label-lg">{line.qty}</span>
                      <button
                        type="button"
                        aria-label="Ko'paytirish"
                        className="w-9 h-9 flex items-center justify-center disabled:opacity-40"
                        disabled={line.qty >= line.stock}
                        onClick={() => cartStore.setQty(line.variantId, line.qty + 1)}
                      >
                        +
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {totals !== null && (
              <div className="bg-surface-container rounded-xl p-space-md flex flex-col gap-space-xs">
                <div className="flex justify-between text-body-sm font-body-sm text-on-surface-variant">
                  <span>{t('cart.itemsTotal')}</span>
                  <span>{formatSom(totals.itemsTotal)}</span>
                </div>
                {totals.discountTotal > 0 && (
                  <div className="flex justify-between text-body-sm font-body-sm text-secondary">
                    <span>{t('cart.discount')}</span>
                    <span>-{formatSom(totals.discountTotal)}</span>
                  </div>
                )}
                <div className="flex justify-between text-body-sm font-body-sm text-on-surface-variant">
                  <span>{t('cart.delivery')}</span>
                  <span>{totals.deliveryFee === 0 ? t('cart.deliveryFree') : formatSom(totals.deliveryFee)}</span>
                </div>
                <div className="flex justify-between text-body-lg font-body-lg text-on-surface font-semibold pt-space-xs border-t border-outline-variant/40">
                  <span>{t('cart.grandTotal')}</span>
                  <span>{formatSom(totals.grandTotal)}</span>
                </div>
                {installmentEstimate !== null && (
                  <p className="text-label-md font-label-md text-installment-text">
                    {t('installment.orMonthly', { amount: formatSom(installmentEstimate), months: settings?.installment_months ?? 12 })}
                  </p>
                )}
                {totals.belowMinimum && (
                  <p className="text-body-sm font-body-sm text-error">
                    {t('cart.minOrderWarning', { amount: formatSom(totals.amountToMinimum) })}
                  </p>
                )}
              </div>
            )}
          </>
        )}
      </main>

      {lines.length > 0 && totals !== null && (
        <div className="fixed bottom-16 left-0 right-0 z-30 px-margin pb-space-sm">
          <button
            type="button"
            disabled={totals.belowMinimum}
            onClick={() => navigate('/checkout')}
            className="w-full h-12 rounded-full bg-primary text-on-primary text-label-lg font-label-lg shadow-lg disabled:opacity-50"
          >
            {t('cart.checkout')} · {formatSom(totals.grandTotal)}
          </button>
        </div>
      )}

      {clearConfirmOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-margin" role="dialog" aria-modal="true">
          <button type="button" aria-label={t('common.close')} className="absolute inset-0 bg-black/50" onClick={() => setClearConfirmOpen(false)} />
          <div className="relative bg-surface-container-low rounded-2xl p-margin w-full max-w-sm">
            <p className="text-body-lg font-body-lg text-on-surface mb-space-md">{t('cart.clearConfirm')}</p>
            <div className="flex gap-space-sm">
              <button
                type="button"
                onClick={() => setClearConfirmOpen(false)}
                className="flex-1 h-11 rounded-full bg-surface-container-high text-on-surface text-label-lg font-label-lg"
              >
                {t('common.cancel')}
              </button>
              <button
                type="button"
                onClick={() => {
                  cartStore.clear();
                  setClearConfirmOpen(false);
                }}
                className="flex-1 h-11 rounded-full bg-error text-on-error text-label-lg font-label-lg"
              >
                {t('common.confirm')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

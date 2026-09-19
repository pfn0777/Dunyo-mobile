import { useParams } from 'react-router-dom';
import { useOrderDetail } from '../lib/queries.ts';
import { useTelegramBackButton } from '../lib/useBackButton.ts';
import { ErrorState, Skeleton } from '../components/States.tsx';
import { formatSom } from '../lib/format.ts';
import { t } from '../lib/i18n.ts';

export function OrderDetail(): JSX.Element {
  useTelegramBackButton('/profile/orders');
  const { id } = useParams<{ id: string }>();
  const orderId = Number(id);
  const { data: order, isLoading, isError, refetch } = useOrderDetail(orderId);

  return (
    <div className="flex flex-col min-h-screen pb-24">
      <header className="sticky top-0 z-30 bg-surface/90 backdrop-blur-xl pt-safe px-margin h-14 flex items-center shadow-sm">
        <h1 className="text-headline-md font-headline-md text-on-surface">{order?.order_no ?? ''}</h1>
      </header>
      <main className="px-margin pt-space-md flex flex-col gap-space-md">
        {isLoading ? (
          <Skeleton className="h-40" />
        ) : isError || order === undefined ? (
          <ErrorState onRetry={() => refetch()} />
        ) : (
          <>
            <section className="bg-surface-container rounded-xl p-space-md shadow-sm">
              <p className="text-body-lg font-body-lg text-on-surface font-semibold mb-1">{t(`status.${order.status}`)}</p>
              {order.tracking_note !== null && (
                <p className="text-body-sm font-body-sm text-on-surface-variant mb-1">{order.tracking_note}</p>
              )}
              <p className="text-body-sm font-body-sm text-on-surface-variant">
                {order.delivery_type === 'delivery'
                  ? [order.region_name, order.address_text].filter(Boolean).join(', ')
                  : t('checkout.pickup')}
              </p>
              {order.payment_method === 'installment_request' && order.installment_months !== null && (
                <p className="text-body-sm font-body-sm text-secondary mt-1">
                  {t('installment.requestNote', { months: order.installment_months })}
                </p>
              )}
            </section>

            <section>
              <h3 className="text-body-lg font-body-lg text-on-surface font-semibold mb-space-sm">{t('orders.detail.items')}</h3>
              <div className="flex flex-col gap-space-xs">
                {order.items.map((item) => (
                  <div key={item.variant_id} className="flex justify-between text-body-sm font-body-sm">
                    <span className="text-on-surface">
                      {item.name_snapshot} · {item.color_snapshot}
                      {item.storage_snapshot !== null ? ` ${item.storage_snapshot}GB` : ''} × {item.qty}
                    </span>
                    <span className="text-on-surface-variant">{formatSom(item.price_snapshot * item.qty)}</span>
                  </div>
                ))}
              </div>
            </section>

            <section className="bg-surface-container rounded-xl p-space-md flex flex-col gap-space-xs">
              <div className="flex justify-between text-body-sm font-body-sm text-on-surface-variant">
                <span>{t('cart.itemsTotal')}</span>
                <span>{formatSom(order.items_total)}</span>
              </div>
              <div className="flex justify-between text-body-sm font-body-sm text-on-surface-variant">
                <span>{t('cart.delivery')}</span>
                <span>{order.delivery_fee === 0 ? t('cart.deliveryFree') : formatSom(order.delivery_fee)}</span>
              </div>
              <div className="flex justify-between text-body-lg font-body-lg text-on-surface font-semibold pt-space-xs border-t border-outline-variant/40">
                <span>{t('cart.grandTotal')}</span>
                <span>{formatSom(order.grand_total)}</span>
              </div>
            </section>

            <section>
              <h3 className="text-body-lg font-body-lg text-on-surface font-semibold mb-space-sm">{t('orders.detail.history')}</h3>
              <div className="flex flex-col gap-space-xs">
                {order.history.map((entry, i) => (
                  <div key={i} className="flex justify-between text-body-sm font-body-sm">
                    <span className="text-on-surface">{t(`status.${entry.to_status}`)}</span>
                    <span className="text-on-surface-variant">{new Date(entry.created_at).toLocaleString('uz-UZ')}</span>
                  </div>
                ))}
              </div>
            </section>
          </>
        )}
      </main>
    </div>
  );
}

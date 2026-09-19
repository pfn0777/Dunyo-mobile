import { useNavigate } from 'react-router-dom';
import { useOrders } from '../lib/queries.ts';
import { useTelegramBackButton } from '../lib/useBackButton.ts';
import { ErrorState, Skeleton } from '../components/States.tsx';
import { formatSom } from '../lib/format.ts';
import { t } from '../lib/i18n.ts';

export function Orders(): JSX.Element {
  useTelegramBackButton('/profile');
  const navigate = useNavigate();
  const { data, isLoading, isError, refetch } = useOrders();

  return (
    <div className="flex flex-col min-h-screen pb-24">
      <header className="sticky top-0 z-30 bg-surface/90 backdrop-blur-xl pt-safe px-margin h-14 flex items-center shadow-sm">
        <h1 className="text-headline-md font-headline-md text-on-surface">{t('orders.title')}</h1>
      </header>
      <main className="px-margin pt-space-md flex flex-col gap-space-sm">
        {isLoading ? (
          Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-20" />)
        ) : isError ? (
          <ErrorState onRetry={() => refetch()} />
        ) : (data?.items.length ?? 0) === 0 ? (
          <p className="text-body-md font-body-md text-on-surface-variant text-center py-space-xl">{t('orders.empty')}</p>
        ) : (
          data!.items.map((order) => (
            <button
              key={order.id}
              type="button"
              onClick={() => navigate(`/profile/orders/${order.id}`)}
              className="bg-surface-container rounded-xl p-space-md shadow-sm text-left flex items-center justify-between"
            >
              <div>
                <p className="text-body-lg font-body-lg text-on-surface font-semibold">{order.order_no}</p>
                <p className="text-body-sm font-body-sm text-on-surface-variant">{t(`status.${order.status}`)}</p>
                {order.tracking_note !== null && (
                  <p className="text-label-sm font-label-sm text-on-surface-variant mt-0.5">{order.tracking_note}</p>
                )}
              </div>
              <p className="text-body-lg font-body-lg text-on-surface font-semibold">{formatSom(order.grand_total)}</p>
            </button>
          ))
        )}
      </main>
    </div>
  );
}

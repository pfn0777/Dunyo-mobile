import { useState } from 'react';
import { Link } from 'react-router-dom';
import { AdminPage } from '../components/AdminPage.tsx';
import { AdminErrorState } from '../components/AdminErrorState.tsx';
import { Skeleton } from '../../components/States.tsx';
import { useAdminOrders, useAdminRegions } from '../queries.ts';
import { formatSom } from '../../lib/format.ts';
import { t } from '../../lib/i18n.ts';
import type { OrderStatus } from '../../lib/types.ts';

const STATUSES: readonly OrderStatus[] = ['new', 'confirmed', 'shipped', 'on_the_way', 'delivered', 'cancelled'];
const PAGE_SIZE = 20;

export function OrdersList(): JSX.Element {
  const [status, setStatus] = useState<OrderStatus | undefined>(undefined);
  const [regionId, setRegionId] = useState<number | undefined>(undefined);
  const [page, setPage] = useState(1);
  const { data: regions } = useAdminRegions();
  const { data, isLoading, isError, error, refetch } = useAdminOrders(status, regionId, page);

  function selectStatus(next: OrderStatus | undefined): void {
    setStatus(next);
    setPage(1);
  }

  return (
    <AdminPage title={t('admin.orders.title')}>
      <div className="flex gap-space-xs overflow-x-auto pb-space-xs">
        <button
          type="button"
          onClick={() => selectStatus(undefined)}
          className={`min-h-[36px] px-space-md rounded-full text-label-md font-label-md whitespace-nowrap ${
            status === undefined ? 'bg-primary text-on-primary' : 'bg-surface-container text-on-surface'
          }`}
        >
          {t('admin.orders.filterAll')}
        </button>
        {STATUSES.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => selectStatus(s)}
            className={`min-h-[36px] px-space-md rounded-full text-label-md font-label-md whitespace-nowrap ${
              status === s ? 'bg-primary text-on-primary' : 'bg-surface-container text-on-surface'
            }`}
          >
            {t(`status.${s}`)}
          </button>
        ))}
      </div>

      <label className="flex flex-col gap-space-xs">
        <span className="text-label-md font-label-md text-on-surface-variant">{t('admin.orders.filterRegion')}</span>
        <select
          value={regionId ?? ''}
          onChange={(e) => {
            setRegionId(e.target.value.length > 0 ? Number(e.target.value) : undefined);
            setPage(1);
          }}
          className="min-h-[44px] px-space-md rounded-xl bg-surface-container text-on-surface text-body-md font-body-md"
        >
          <option value="">{t('admin.orders.filterAll')}</option>
          {(regions ?? []).map((r) => (
            <option key={r.id} value={r.id}>
              {r.name}
            </option>
          ))}
        </select>
      </label>

      {isLoading ? (
        Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-20" />)
      ) : isError ? (
        <AdminErrorState error={error} onRetry={() => void refetch()} />
      ) : (data?.items.length ?? 0) === 0 ? (
        <p className="text-body-md font-body-md text-on-surface-variant text-center py-space-2xl">{t('admin.orders.empty')}</p>
      ) : (
        <>
          <div className="flex flex-col gap-space-sm">
            {data!.items.map((order) => (
              <Link
                key={order.id}
                to={`/admin/orders/${order.id}`}
                className="bg-surface-container-lowest rounded-2xl p-space-md shadow-sm flex items-center justify-between gap-space-sm"
              >
                <div className="min-w-0">
                  <p className="text-title-sm font-title-sm text-on-surface truncate">{order.order_no}</p>
                  <p className="text-body-sm font-body-sm text-on-surface-variant truncate">
                    {t(`status.${order.status}`)}
                    {order.region_name !== null ? ` · ${order.region_name}` : ''} &middot;{' '}
                    {new Date(order.created_at).toLocaleString('uz-UZ', { timeZone: 'Asia/Tashkent' })}
                  </p>
                  {order.payment_method === 'installment_request' && (
                    <span className="inline-block mt-space-xs text-body-sm font-body-sm text-primary bg-primary/10 rounded-full px-space-sm py-0.5">
                      {t('admin.orders.installmentFlag')}
                    </span>
                  )}
                </div>
                <p className="text-title-sm font-title-sm text-on-surface shrink-0">{formatSom(order.grand_total)}</p>
              </Link>
            ))}
          </div>
          <div className="flex items-center justify-between py-space-md">
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="min-h-[40px] px-space-md rounded-xl bg-surface-container text-on-surface text-label-md font-label-md disabled:opacity-40"
            >
              {t('admin.prev')}
            </button>
            <span className="text-body-sm font-body-sm text-on-surface-variant">{page}</span>
            <button
              type="button"
              disabled={page * PAGE_SIZE >= (data?.total ?? 0)}
              onClick={() => setPage((p) => p + 1)}
              className="min-h-[40px] px-space-md rounded-xl bg-surface-container text-on-surface text-label-md font-label-md disabled:opacity-40"
            >
              {t('admin.next')}
            </button>
          </div>
        </>
      )}
    </AdminPage>
  );
}

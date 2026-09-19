import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { AdminPage } from '../components/AdminPage.tsx';
import { AdminErrorState } from '../components/AdminErrorState.tsx';
import { ConfirmDialog } from '../components/ConfirmDialog.tsx';
import { Skeleton } from '../../components/States.tsx';
import { useAdminOrder, useSetOrderStatus } from '../queries.ts';
import { allowedNextStatuses } from '../orderStatusHelpers.ts';
import { formatSom } from '../../lib/format.ts';
import { t } from '../../lib/i18n.ts';
import { useToast } from '../../lib/toast.tsx';
import { ApiError } from '../../lib/apiError.ts';
import type { OrderStatus } from '../../lib/types.ts';

function mapLinks(lat: number, lng: number): { google: string; yandex: string } {
  return {
    google: `https://maps.google.com/?q=${lat},${lng}`,
    yandex: `https://yandex.uz/maps/?pt=${lng},${lat}&z=17`,
  };
}

function paymentMethodLabel(method: string): string {
  switch (method) {
    case 'cash':
      return t('checkout.paymentCash');
    case 'card_to_courier':
      return t('checkout.paymentCard');
    case 'installment_request':
      return t('checkout.paymentInstallment');
    default:
      return method;
  }
}

export function OrderDetail(): JSX.Element {
  const { id } = useParams<{ id: string }>();
  const orderId = Number(id);
  const { data: order, isLoading, isError, error, refetch } = useAdminOrder(orderId);
  const setStatus = useSetOrderStatus(orderId);
  const toast = useToast();
  const [pendingStatus, setPendingStatus] = useState<OrderStatus | null>(null);
  const [trackingNote, setTrackingNote] = useState('');

  async function applyStatus(status: OrderStatus, note: string | null): Promise<void> {
    try {
      await setStatus.mutateAsync({ status, trackingNote: note });
      toast.show(t('admin.orders.statusUpdated'));
    } catch (err) {
      if (err instanceof ApiError && err.code === 'invalid_transition') {
        toast.show(t('admin.orders.invalidTransition'));
        void refetch();
      } else {
        toast.show(t('common.error'));
      }
    } finally {
      setPendingStatus(null);
      setTrackingNote('');
    }
  }

  function handleStatusClick(status: OrderStatus): void {
    // 'cancelled' and 'shipped' both need a confirmation step: cancelled
    // because it is destructive, shipped because it can carry an optional
    // tracking note (courier/tracking number for a regional delivery).
    if (status === 'cancelled' || status === 'shipped') {
      setPendingStatus(status);
      return;
    }
    void applyStatus(status, null);
  }

  if (isLoading) {
    return (
      <AdminPage title={t('admin.orders.detailTitle')}>
        <Skeleton className="h-40" />
        <Skeleton className="h-40" />
      </AdminPage>
    );
  }
  if (isError || order === undefined) {
    return (
      <AdminPage title={t('admin.orders.detailTitle')}>
        <AdminErrorState error={error} onRetry={() => void refetch()} />
      </AdminPage>
    );
  }

  const nextStatuses = allowedNextStatuses(order.status, order.delivery_type);
  const links = order.lat !== null && order.lng !== null ? mapLinks(order.lat, order.lng) : null;

  return (
    <AdminPage title={order.order_no}>
      {order.payment_method === 'installment_request' && (
        <section className="bg-primary/10 rounded-2xl p-space-md flex items-center gap-space-sm">
          <span className="material-symbols-outlined text-primary">credit_card</span>
          <div>
            <p className="text-title-sm font-title-sm text-on-surface">{t('admin.orders.installmentFlag')}</p>
            {order.installment_months !== null && (
              <p className="text-body-sm font-body-sm text-on-surface-variant">
                {t('admin.settings.installmentMonths')}: {order.installment_months}
              </p>
            )}
          </div>
        </section>
      )}

      <section className="bg-surface-container-lowest rounded-2xl p-space-md shadow-sm flex flex-col gap-space-xs">
        <p className="text-title-sm font-title-sm text-on-surface">{t(`status.${order.status}`)}</p>
        <p className="text-body-md font-body-md text-on-surface">{order.customer_name}</p>
        <a href={`tel:${order.customer_phone}`} className="text-body-md font-body-md text-primary">
          {order.customer_phone}
        </a>
        {order.delivery_type === 'delivery' ? (
          <>
            {order.region_name !== null && (
              <p className="text-body-sm font-body-sm text-on-surface-variant">{t('checkout.region')}: {order.region_name}</p>
            )}
            <p className="text-body-sm font-body-sm text-on-surface-variant">{order.address_text}</p>
            {links !== null && (
              <div className="flex gap-space-sm">
                <a href={links.google} target="_blank" rel="noreferrer" className="text-body-sm font-body-sm text-primary">
                  Google Maps
                </a>
                <a href={links.yandex} target="_blank" rel="noreferrer" className="text-body-sm font-body-sm text-primary">
                  Yandex Maps
                </a>
              </div>
            )}
          </>
        ) : (
          <p className="text-body-sm font-body-sm text-on-surface-variant">{t('checkout.pickup')}</p>
        )}
        {order.comment !== null && order.comment.length > 0 && (
          <p className="text-body-sm font-body-sm text-on-surface-variant">{t('checkout.comment')}: {order.comment}</p>
        )}
        {order.tracking_note !== null && order.tracking_note.length > 0 && (
          <p className="text-body-sm font-body-sm text-on-surface-variant">{t('admin.orders.trackingNote')}: {order.tracking_note}</p>
        )}
      </section>

      <section className="bg-surface-container-lowest rounded-2xl p-space-md shadow-sm flex flex-col gap-space-xs">
        <p className="text-title-sm font-title-sm text-on-surface mb-space-xs">{t('orders.detail.items')}</p>
        {order.items.map((item, i) => (
          <div key={i} className="flex items-center justify-between text-body-sm font-body-sm">
            <span className="text-on-surface">
              {item.name_snapshot}
              {item.color_snapshot !== null && item.color_snapshot.length > 0 ? ` (${item.color_snapshot}` : ''}
              {item.storage_snapshot !== null ? `, ${item.storage_snapshot} GB)` : item.color_snapshot !== null && item.color_snapshot.length > 0 ? ')' : ''}
              {' '}&times; {item.qty}
            </span>
            <span className="text-on-surface-variant">{formatSom(item.price_snapshot * item.qty)}</span>
          </div>
        ))}
        <div className="border-t border-outline-variant mt-space-sm pt-space-sm flex flex-col gap-space-xs">
          <div className="flex justify-between text-body-sm font-body-sm text-on-surface-variant">
            <span>{t('cart.itemsTotal')}</span>
            <span>{formatSom(order.items_total)}</span>
          </div>
          <div className="flex justify-between text-body-sm font-body-sm text-on-surface-variant">
            <span>{t('cart.delivery')}</span>
            <span>{order.delivery_fee === 0 ? t('cart.deliveryFree') : formatSom(order.delivery_fee)}</span>
          </div>
          <div className="flex justify-between text-title-sm font-title-sm text-on-surface">
            <span>{t('cart.grandTotal')}</span>
            <span>{formatSom(order.grand_total)}</span>
          </div>
          <div className="flex justify-between text-body-sm font-body-sm text-on-surface-variant">
            <span>{t('checkout.paymentMethod')}</span>
            <span>{paymentMethodLabel(order.payment_method)}</span>
          </div>
        </div>
      </section>

      <section className="bg-surface-container-lowest rounded-2xl p-space-md shadow-sm flex flex-col gap-space-xs">
        <p className="text-title-sm font-title-sm text-on-surface mb-space-xs">{t('orders.detail.history')}</p>
        {order.history.map((h, i) => (
          <div key={i} className="flex justify-between text-body-sm font-body-sm text-on-surface-variant">
            <span>{h.from_status !== null ? `${t(`status.${h.from_status}`)} → ` : ''}{t(`status.${h.to_status}`)}</span>
            <span>{new Date(h.created_at).toLocaleString('uz-UZ', { timeZone: 'Asia/Tashkent' })}</span>
          </div>
        ))}
      </section>

      {nextStatuses.length > 0 && (
        <section className="flex flex-col gap-space-sm">
          <p className="text-title-sm font-title-sm text-on-surface">{t('admin.orders.changeStatus')}</p>
          <div className="flex flex-wrap gap-space-sm">
            {nextStatuses.map((s) => (
              <button
                key={s}
                type="button"
                disabled={setStatus.isPending}
                onClick={() => handleStatusClick(s)}
                className="min-h-[44px] px-space-lg rounded-xl bg-primary text-on-primary text-label-md font-label-md disabled:opacity-50"
              >
                {t(`status.${s}`)}
              </button>
            ))}
          </div>
        </section>
      )}

      {pendingStatus === 'cancelled' && (
        <ConfirmDialog
          message={t('admin.orders.cancelConfirm')}
          danger
          confirmLabel={t('common.confirm')}
          pending={setStatus.isPending}
          onCancel={() => setPendingStatus(null)}
          onConfirm={() => void applyStatus('cancelled', null)}
        />
      )}

      {pendingStatus === 'shipped' && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 px-space-lg">
          <div className="bg-surface-container-lowest rounded-2xl p-space-lg w-full max-w-sm shadow-lg flex flex-col gap-space-md">
            <p className="text-body-md font-body-md text-on-surface">{t('admin.orders.shipConfirm')}</p>
            <label className="flex flex-col gap-space-xs">
              <span className="text-label-md font-label-md text-on-surface-variant">{t('admin.orders.trackingNote')}</span>
              <textarea
                value={trackingNote}
                onChange={(e) => setTrackingNote(e.target.value)}
                rows={3}
                placeholder={t('admin.orders.trackingNoteHint')}
                className="px-space-md py-space-sm rounded-xl bg-surface-container text-on-surface text-body-md font-body-md"
              />
            </label>
            <div className="flex gap-space-sm justify-end">
              <button
                type="button"
                onClick={() => {
                  setPendingStatus(null);
                  setTrackingNote('');
                }}
                disabled={setStatus.isPending}
                className="min-h-[44px] px-space-lg rounded-xl bg-surface-container text-on-surface text-label-md font-label-md disabled:opacity-50"
              >
                {t('common.cancel')}
              </button>
              <button
                type="button"
                disabled={setStatus.isPending}
                onClick={() => void applyStatus('shipped', trackingNote.trim().length > 0 ? trackingNote.trim() : null)}
                className="min-h-[44px] px-space-lg rounded-xl bg-primary text-on-primary text-label-md font-label-md disabled:opacity-50"
              >
                {t('common.confirm')}
              </button>
            </div>
          </div>
        </div>
      )}
    </AdminPage>
  );
}

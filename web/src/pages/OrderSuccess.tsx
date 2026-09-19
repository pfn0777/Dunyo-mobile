import { useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useOrderDetail } from '../lib/queries.ts';
import { hapticSuccess } from '../lib/telegram.ts';
import { Skeleton } from '../components/States.tsx';
import { t } from '../lib/i18n.ts';

export function OrderSuccess(): JSX.Element {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const orderId = Number(id);
  const { data: order, isLoading } = useOrderDetail(orderId);

  useEffect(() => {
    hapticSuccess();
  }, []);

  return (
    <div className="flex flex-col items-center justify-center min-h-screen px-margin text-center gap-space-md">
      <span className="material-symbols-outlined text-[56px] text-primary">check_circle</span>
      <h1 className="text-headline-xl font-headline-xl text-on-surface">{t('orderSuccess.title')}</h1>
      {isLoading ? (
        <Skeleton className="w-40 h-6" />
      ) : order !== undefined ? (
        <div className="flex flex-col gap-1">
          <p className="text-body-md font-body-md text-on-surface-variant">
            {t('orderSuccess.orderNo')}: <span className="text-on-surface">{order.order_no}</span>
          </p>
          <p className="text-body-md font-body-md text-on-surface-variant">
            {t('orderSuccess.status')}: <span className="text-on-surface">{t(`status.${order.status}`)}</span>
          </p>
          {order.payment_method === 'installment_request' && (
            <p className="text-body-sm font-body-sm text-secondary mt-1">{t('orderSuccess.installmentNote')}</p>
          )}
        </div>
      ) : null}
      <div className="flex flex-col gap-space-sm w-full max-w-xs mt-space-md">
        <button
          type="button"
          onClick={() => navigate('/profile/orders')}
          className="h-11 rounded-full bg-primary text-on-primary text-label-lg font-label-lg"
        >
          {t('orderSuccess.toOrders')}
        </button>
        <button
          type="button"
          onClick={() => navigate('/')}
          className="h-11 rounded-full bg-surface-container text-on-surface text-label-lg font-label-lg"
        >
          {t('orderSuccess.toHome')}
        </button>
      </div>
    </div>
  );
}

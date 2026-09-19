import { useEffect, useState } from 'react';
import { AdminPage } from '../components/AdminPage.tsx';
import { AdminErrorState } from '../components/AdminErrorState.tsx';
import { Skeleton } from '../../components/States.tsx';
import { useAdminSettings, useUpdateSettings } from '../queries.ts';
import { t } from '../../lib/i18n.ts';
import { useToast } from '../../lib/toast.tsx';

function formatGrouped(digits: string): string {
  const clean = digits.replace(/\D/g, '');
  if (clean.length === 0) return '';
  return clean.replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
}

function ungroup(value: string): string {
  return value.replace(/\D/g, '');
}

export function Settings(): JSX.Element {
  const { data, isLoading, isError, error, refetch } = useAdminSettings();
  const update = useUpdateSettings();
  const toast = useToast();

  const [freeDeliveryThreshold, setFreeDeliveryThreshold] = useState('');
  const [minOrderAmount, setMinOrderAmount] = useState('');
  const [deliveryEnabled, setDeliveryEnabled] = useState(true);
  const [shopGroupChatId, setShopGroupChatId] = useState('');
  const [pickupAddress, setPickupAddress] = useState('');
  const [requiredChannel, setRequiredChannel] = useState('');
  const [installmentMonths, setInstallmentMonths] = useState('');
  const [supportUsername, setSupportUsername] = useState('');
  const [error_, setError_] = useState<string | null>(null);

  useEffect(() => {
    if (data === undefined) return;
    setFreeDeliveryThreshold(String(data.free_delivery_threshold));
    setMinOrderAmount(String(data.min_order_amount));
    setDeliveryEnabled(data.delivery_enabled);
    setShopGroupChatId(data.shop_group_chat_id !== null ? String(data.shop_group_chat_id) : '');
    setPickupAddress(data.pickup_address ?? '');
    setRequiredChannel(data.required_channel ?? '');
    setInstallmentMonths(String(data.installment_months));
    setSupportUsername(data.support_username ?? '');
  }, [data]);

  async function save(): Promise<void> {
    setError_(null);
    const threshold = Number(ungroup(freeDeliveryThreshold));
    const minOrder = Number(ungroup(minOrderAmount));
    const months = Number(installmentMonths.replace(/\D/g, ''));
    if (!Number.isInteger(threshold) || threshold < 0 || !Number.isInteger(minOrder) || minOrder < 0) {
      setError_(t('admin.settings.errorAmounts'));
      return;
    }
    if (!Number.isInteger(months) || months <= 0) {
      setError_(t('admin.settings.errorInstallmentMonths'));
      return;
    }
    const chatId = shopGroupChatId.trim().length > 0 ? Number(shopGroupChatId.trim()) : null;
    if (chatId !== null && !Number.isInteger(chatId)) {
      setError_(t('admin.settings.errorChatId'));
      return;
    }
    const channel = requiredChannel.trim().replace(/^@/, '');
    if (channel.length > 0 && !/^([A-Za-z][A-Za-z0-9_]{4,31}|-100\d{5,16})$/.test(channel)) {
      setError_(t('admin.settings.errorRequiredChannel'));
      return;
    }
    await update.mutateAsync({
      freeDeliveryThreshold: threshold,
      minOrderAmount: minOrder,
      deliveryEnabled,
      shopGroupChatId: chatId,
      pickupAddress: pickupAddress.trim().length > 0 ? pickupAddress.trim() : null,
      requiredChannel: channel.length > 0 ? channel : null,
      installmentMonths: months,
      supportUsername: supportUsername.trim().length > 0 ? supportUsername.trim() : null,
    });
    toast.show(t('admin.settings.saved'));
  }

  if (isLoading) {
    return (
      <AdminPage title={t('admin.menu.settings')}>
        <Skeleton className="h-14" />
        <Skeleton className="h-14" />
        <Skeleton className="h-14" />
      </AdminPage>
    );
  }
  if (isError) {
    return (
      <AdminPage title={t('admin.menu.settings')}>
        <AdminErrorState error={error} onRetry={() => void refetch()} />
      </AdminPage>
    );
  }

  return (
    <AdminPage title={t('admin.menu.settings')}>
      <div className="flex items-center justify-between bg-surface-container-lowest rounded-2xl p-space-md shadow-sm">
        <span className="text-title-sm font-title-sm text-on-surface">{t('admin.settings.deliveryEnabled')}</span>
        <button
          type="button"
          role="switch"
          aria-checked={deliveryEnabled}
          onClick={() => setDeliveryEnabled((v) => !v)}
          className={`w-12 h-7 rounded-full flex items-center px-0.5 transition-colors ${deliveryEnabled ? 'bg-primary justify-end' : 'bg-surface-container justify-start'}`}
        >
          <span className="w-6 h-6 rounded-full bg-surface-container-lowest shadow" />
        </button>
      </div>

      <label className="flex flex-col gap-space-xs">
        <span className="text-label-md font-label-md text-on-surface-variant">{t('admin.settings.minOrderAmount')}</span>
        <input
          inputMode="numeric"
          value={formatGrouped(minOrderAmount)}
          onChange={(e) => setMinOrderAmount(ungroup(e.target.value))}
          className="min-h-[44px] px-space-md rounded-xl bg-surface-container text-on-surface text-body-md font-body-md"
        />
      </label>

      <label className="flex flex-col gap-space-xs">
        <span className="text-label-md font-label-md text-on-surface-variant">{t('admin.settings.freeDeliveryThreshold')}</span>
        <input
          inputMode="numeric"
          value={formatGrouped(freeDeliveryThreshold)}
          onChange={(e) => setFreeDeliveryThreshold(ungroup(e.target.value))}
          className="min-h-[44px] px-space-md rounded-xl bg-surface-container text-on-surface text-body-md font-body-md"
        />
        <span className="text-body-sm font-body-sm text-error">{t('admin.settings.freeDeliveryZeroWarning')}</span>
      </label>

      <label className="flex flex-col gap-space-xs">
        <span className="text-label-md font-label-md text-on-surface-variant">{t('admin.settings.installmentMonths')}</span>
        <input
          inputMode="numeric"
          value={installmentMonths}
          onChange={(e) => setInstallmentMonths(e.target.value.replace(/\D/g, ''))}
          className="min-h-[44px] px-space-md rounded-xl bg-surface-container text-on-surface text-body-md font-body-md"
        />
      </label>

      <label className="flex flex-col gap-space-xs">
        <span className="text-label-md font-label-md text-on-surface-variant">{t('admin.settings.supportUsername')}</span>
        <input
          value={supportUsername}
          onChange={(e) => setSupportUsername(e.target.value)}
          placeholder="@dunyo_mobile_support"
          className="min-h-[44px] px-space-md rounded-xl bg-surface-container text-on-surface text-body-md font-body-md"
        />
      </label>

      <label className="flex flex-col gap-space-xs">
        <span className="text-label-md font-label-md text-on-surface-variant">{t('admin.settings.shopGroupChatId')}</span>
        <input
          inputMode="numeric"
          value={shopGroupChatId}
          onChange={(e) => setShopGroupChatId(e.target.value.replace(/[^\d-]/g, ''))}
          className="min-h-[44px] px-space-md rounded-xl bg-surface-container text-on-surface text-body-md font-body-md"
        />
      </label>

      <label className="flex flex-col gap-space-xs">
        <span className="text-label-md font-label-md text-on-surface-variant">{t('admin.settings.requiredChannel')}</span>
        <input
          value={requiredChannel}
          onChange={(e) => setRequiredChannel(e.target.value)}
          placeholder="@kanal_nomi"
          className="min-h-[44px] px-space-md rounded-xl bg-surface-container text-on-surface text-body-md font-body-md"
        />
        <span className="text-body-sm font-body-sm text-on-surface-variant">{t('admin.settings.requiredChannelHint')}</span>
      </label>

      <label className="flex flex-col gap-space-xs">
        <span className="text-label-md font-label-md text-on-surface-variant">{t('admin.settings.pickupAddress')}</span>
        <textarea
          value={pickupAddress}
          onChange={(e) => setPickupAddress(e.target.value)}
          rows={3}
          className="px-space-md py-space-sm rounded-xl bg-surface-container text-on-surface text-body-md font-body-md"
        />
      </label>

      {error_ !== null && <p className="text-body-sm font-body-sm text-error">{error_}</p>}

      <button
        type="button"
        disabled={update.isPending}
        onClick={() => void save()}
        className="min-h-[48px] rounded-xl bg-primary text-on-primary text-label-md font-label-md disabled:opacity-50"
      >
        {t('profile.save')}
      </button>
    </AdminPage>
  );
}

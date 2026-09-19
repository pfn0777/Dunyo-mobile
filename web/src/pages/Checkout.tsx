import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAddresses, useMe, useRegions, useSettings } from '../lib/queries.ts';
import { useCartLines } from '../lib/useCart.ts';
import { cartStore } from '../lib/cart.ts';
import { getClient } from '../lib/client.ts';
import { getOrCreateIdempotencyKey } from '../lib/idempotency.ts';
import { mapCheckoutError } from '../lib/checkoutErrors.ts';
import { ApiError } from '../lib/apiError.ts';
import { getDeviceLocation, isLocationSupported, requestContact } from '../lib/telegram.ts';
import { useTelegramBackButton } from '../lib/useBackButton.ts';
import { formatSom } from '../lib/format.ts';
import { normalizePhone } from '../../../shared/src/phone.ts';
import { getSelectedRegionIdSnapshot, setSelectedRegionId, useSelectedRegionId } from '../lib/region.ts';
import { t } from '../lib/i18n.ts';
import type { DeliveryType, PaymentMethod } from '../lib/types.ts';

const CONTACT_BOT_SYNC_DELAY_MS = 1500;

export function Checkout(): JSX.Element {
  useTelegramBackButton('/cart');
  const navigate = useNavigate();
  const lines = useCartLines();
  const { data: settings } = useSettings();
  const { data: regions } = useRegions();
  const { data: me, refetch: refetchMe } = useMe();
  const { data: addresses } = useAddresses();
  const selectedRegionId = useSelectedRegionId();

  const [deliveryType, setDeliveryType] = useState<DeliveryType>('delivery');
  const [addressId, setAddressId] = useState<number | null>(null);
  const [newAddressText, setNewAddressText] = useState('');
  const [location, setLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [name, setName] = useState('');
  const [phoneInput, setPhoneInput] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash');
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [errorText, setErrorText] = useState<string | null>(null);

  useEffect(() => {
    if (settings !== undefined && !settings.delivery_enabled) setDeliveryType('pickup');
  }, [settings]);
  useEffect(() => {
    if (me?.first_name !== undefined) setName((prev) => (prev.length > 0 ? prev : me.first_name));
  }, [me]);
  useEffect(() => {
    if (addresses !== undefined && addresses.length > 0 && addressId === null) {
      const def = addresses.find((a) => a.is_default) ?? addresses[0];
      if (def !== undefined) setAddressId(def.id);
    }
  }, [addresses, addressId]);
  useEffect(() => {
    // Seed the region picker from whatever the Home header last selected;
    // otherwise default to the first active region so the fee/ETA show up.
    if (selectedRegionId === null && regions !== undefined && regions.length > 0 && regions[0] !== undefined) {
      setSelectedRegionId(regions[0].id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [regions]);

  const region = regions?.find((r) => r.id === selectedRegionId) ?? null;

  const totals = useMemo(
    () =>
      settings !== undefined
        ? cartStore.totals(
            {
              regionDeliveryFee: region?.delivery_fee ?? 0,
              freeDeliveryThreshold: settings.free_delivery_threshold,
              regionFreeThreshold: region?.free_delivery_threshold ?? null,
              minOrderAmount: settings.min_order_amount,
              deliveryEnabled: settings.delivery_enabled,
            },
            deliveryType,
          )
        : null,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [settings, deliveryType, region, lines],
  );

  const selectedAddress = addresses?.find((a) => a.id === addressId) ?? null;
  const addressText = selectedAddress?.text ?? (newAddressText.trim().length > 0 ? newAddressText.trim() : null);
  const normalizedPhone = normalizePhone(phoneInput);
  const havePhone = me?.phone_verified === true || normalizedPhone !== null;

  const canSubmit =
    lines.length > 0 &&
    totals !== null &&
    !totals.belowMinimum &&
    name.trim().length > 0 &&
    havePhone &&
    (deliveryType === 'pickup' || (addressText !== null && addressText.length > 0 && selectedRegionId !== null)) &&
    !submitting;

  const handleShareContact = async (): Promise<void> => {
    setErrorText(null);
    const result = await requestContact();
    if (!result.granted) return;
    if (result.response === null) {
      // The signed payload did not arrive; the bot webhook still receives the
      // shared contact and saves the phone, so give it a moment and re-read.
      await new Promise((resolve) => setTimeout(resolve, CONTACT_BOT_SYNC_DELAY_MS));
      const refreshed = await refetchMe();
      if (refreshed.data?.phone_verified !== true) setErrorText(t('checkout.contactNotReceived'));
      return;
    }
    try {
      const client = await getClient();
      await client.postContact(result.response);
      await refetchMe();
    } catch (error) {
      console.error('handleShareContact: postContact failed', error);
      setErrorText(
        error instanceof ApiError && error.code === 'bad_payload' ? t('checkout.contactNotUzbek') : t('checkout.genericError'),
      );
    }
  };

  const handleSendLocation = async (): Promise<void> => {
    const loc = await getDeviceLocation();
    if (loc !== null) setLocation(loc);
  };

  const handleSubmit = async (): Promise<void> => {
    if (!canSubmit || totals === null) return;
    setSubmitting(true);
    setErrorText(null);
    const idempotencyKey = getOrCreateIdempotencyKey(lines);
    try {
      const client = await getClient();
      const result = await client.postOrder({
        idempotencyKey,
        deliveryType,
        regionId: deliveryType === 'delivery' ? getSelectedRegionIdSnapshot() : null,
        addressText: deliveryType === 'delivery' ? addressText : null,
        lat: location?.latitude ?? null,
        lng: location?.longitude ?? null,
        customerName: name.trim(),
        customerPhone: (me?.phone_verified === true ? me.phone : normalizedPhone) ?? '',
        comment: comment.trim().length > 0 ? comment.trim() : null,
        paymentMethod,
        items: lines.map((l) => ({ variant_id: l.variantId, qty: l.qty, expected_price: l.price })),
      });
      cartStore.clear();
      navigate(`/orders/${result.order_id}/success`);
    } catch (error) {
      if (error instanceof ApiError) {
        const mapped = mapCheckoutError(error);
        if (mapped.kind === 'stock_changed') {
          for (const item of mapped.items) {
            if (item.available <= 0) cartStore.remove(item.variant_id);
            else cartStore.setQty(item.variant_id, item.available);
          }
          setErrorText(t('checkout.stockChangedError'));
        } else if (mapped.kind === 'price_changed') {
          const client = await getClient();
          const productIds = [...new Set(lines.map((l) => l.productId))];
          const details = await Promise.all(productIds.map((id) => client.getProductById(id).catch(() => null)));
          const freshVariants = details
            .filter((d): d is NonNullable<typeof d> => d !== null)
            .flatMap((d) => d.variants.map((v) => ({ id: v.id, price: v.price, oldPrice: v.old_price, stock: v.stock })));
          cartStore.reconcile(freshVariants);
          setErrorText(t('checkout.priceChangedError'));
        } else if (mapped.kind === 'delivery_disabled') {
          setDeliveryType('pickup');
          setErrorText(t('checkout.deliveryDisabled'));
        } else if (mapped.kind === 'region_invalid') {
          setErrorText(t('checkout.regionInvalid'));
        } else if (mapped.kind === 'min_order') {
          setErrorText(t('checkout.minOrderError', { amount: formatSom(mapped.minOrderAmount) }));
        } else {
          setErrorText(t('checkout.genericError'));
        }
      } else {
        console.error('handleSubmit: unexpected error', error);
        setErrorText(t('checkout.genericError'));
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex flex-col min-h-screen pb-32">
      <header className="sticky top-0 z-30 bg-surface/90 backdrop-blur-xl pt-safe px-margin h-14 flex items-center shadow-sm">
        <h1 className="text-headline-md font-headline-md text-on-surface">{t('checkout.title')}</h1>
      </header>

      <main className="px-margin pt-space-md flex flex-col gap-space-lg">
        <section>
          <h3 className="text-body-lg font-body-lg text-on-surface font-semibold mb-space-sm">{t('checkout.deliveryType')}</h3>
          <div className="flex gap-space-sm">
            <button
              type="button"
              disabled={settings !== undefined && !settings.delivery_enabled}
              onClick={() => setDeliveryType('delivery')}
              className={`flex-1 h-11 rounded-full text-label-lg font-label-lg disabled:opacity-40 ${
                deliveryType === 'delivery' ? 'bg-primary text-on-primary' : 'bg-surface-container text-on-surface-variant'
              }`}
            >
              {t('checkout.delivery')}
            </button>
            <button
              type="button"
              onClick={() => setDeliveryType('pickup')}
              className={`flex-1 h-11 rounded-full text-label-lg font-label-lg ${
                deliveryType === 'pickup' ? 'bg-primary text-on-primary' : 'bg-surface-container text-on-surface-variant'
              }`}
            >
              {t('checkout.pickup')}
            </button>
          </div>
          {settings !== undefined && !settings.delivery_enabled && (
            <p className="text-body-sm font-body-sm text-error mt-space-xs">{t('checkout.deliveryDisabled')}</p>
          )}
        </section>

        {deliveryType === 'pickup' ? (
          <section>
            <h3 className="text-body-lg font-body-lg text-on-surface font-semibold mb-space-xs">{t('checkout.pickupAddress')}</h3>
            <p className="text-body-md font-body-md text-on-surface-variant">{settings?.pickup_address ?? '-'}</p>
          </section>
        ) : (
          <>
            <section>
              <h3 className="text-body-lg font-body-lg text-on-surface font-semibold mb-space-sm">{t('checkout.region')}</h3>
              <div className="flex flex-wrap gap-space-sm">
                {(regions ?? []).map((r) => (
                  <button
                    key={r.id}
                    type="button"
                    onClick={() => setSelectedRegionId(r.id)}
                    className={`px-space-md h-9 rounded-full text-label-md font-label-md ${
                      selectedRegionId === r.id ? 'bg-primary text-on-primary' : 'bg-surface-container text-on-surface-variant'
                    }`}
                  >
                    {r.name}
                  </button>
                ))}
              </div>
              {region !== null && (
                <p className="text-body-sm font-body-sm text-on-surface-variant mt-space-xs">
                  {t('checkout.regionFee', { fee: formatSom(region.delivery_fee) })}
                  {region.eta_text !== null ? ` · ${region.eta_text}` : ''}
                </p>
              )}
            </section>

            <section>
              <h3 className="text-body-lg font-body-lg text-on-surface font-semibold mb-space-sm">{t('checkout.address')}</h3>
              <div className="flex flex-col gap-space-xs">
                {(addresses ?? []).map((a) => (
                  <button
                    key={a.id}
                    type="button"
                    onClick={() => {
                      setAddressId(a.id);
                      setNewAddressText('');
                    }}
                    className={`text-left px-space-md py-space-sm rounded-xl border ${
                      addressId === a.id ? 'border-primary bg-primary/5' : 'border-outline-variant/40'
                    }`}
                  >
                    <span className="text-body-md font-body-md text-on-surface">{a.text}</span>
                  </button>
                ))}
                <textarea
                  value={newAddressText}
                  onChange={(e) => {
                    setNewAddressText(e.target.value);
                    setAddressId(null);
                  }}
                  placeholder={t('checkout.addAddress')}
                  aria-label={t('checkout.addressText')}
                  className="w-full rounded-xl border border-outline-variant/40 bg-transparent px-space-md py-space-sm text-body-md font-body-md focus:outline-primary"
                  rows={2}
                />
                {isLocationSupported() && (
                  <button
                    type="button"
                    onClick={() => void handleSendLocation()}
                    className="self-start flex items-center gap-1 text-label-lg font-label-lg text-primary min-h-[44px]"
                  >
                    <span className="material-symbols-outlined text-[18px]">location_on</span>
                    {t('checkout.sendLocation')}
                    {location !== null && ' ✓'}
                  </button>
                )}
              </div>
            </section>
          </>
        )}

        <section>
          <h3 className="text-body-lg font-body-lg text-on-surface font-semibold mb-space-sm">{t('checkout.name')}</h3>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            aria-label={t('checkout.name')}
            className="w-full h-11 rounded-xl border border-outline-variant/40 bg-transparent px-space-md text-body-md font-body-md focus:outline-primary"
          />
        </section>

        <section>
          <h3 className="text-body-lg font-body-lg text-on-surface font-semibold mb-space-sm">{t('checkout.phone')}</h3>
          {me?.phone_verified === true ? (
            <p className="text-body-md font-body-md text-on-surface">{me.phone}</p>
          ) : (
            <div className="flex flex-col gap-space-sm">
              <button
                type="button"
                onClick={() => void handleShareContact()}
                className="self-start flex items-center gap-1 text-label-lg font-label-lg text-primary min-h-[44px]"
              >
                <span className="material-symbols-outlined text-[18px]">call</span>
                {t('checkout.sharePhone')}
              </button>
              <input
                value={phoneInput}
                onChange={(e) => setPhoneInput(e.target.value)}
                placeholder="+998901234567"
                aria-label={t('checkout.phone')}
                className="w-full h-11 rounded-xl border border-outline-variant/40 bg-transparent px-space-md text-body-md font-body-md focus:outline-primary"
              />
            </div>
          )}
        </section>

        <section>
          <h3 className="text-body-lg font-body-lg text-on-surface font-semibold mb-space-sm">{t('checkout.paymentMethod')}</h3>
          <div className="flex flex-col gap-space-sm">
            <button
              type="button"
              onClick={() => setPaymentMethod('cash')}
              className={`h-11 rounded-xl text-label-lg font-label-lg text-left px-space-md ${
                paymentMethod === 'cash' ? 'bg-primary text-on-primary' : 'bg-surface-container text-on-surface-variant'
              }`}
            >
              {t('checkout.paymentCash')}
            </button>
            <button
              type="button"
              onClick={() => setPaymentMethod('card_to_courier')}
              className={`h-11 rounded-xl text-label-lg font-label-lg text-left px-space-md ${
                paymentMethod === 'card_to_courier' ? 'bg-primary text-on-primary' : 'bg-surface-container text-on-surface-variant'
              }`}
            >
              {t('checkout.paymentCard')}
            </button>
            <button
              type="button"
              onClick={() => setPaymentMethod('installment_request')}
              className={`h-11 rounded-xl text-label-lg font-label-lg text-left px-space-md ${
                paymentMethod === 'installment_request' ? 'bg-primary text-on-primary' : 'bg-surface-container text-on-surface-variant'
              }`}
            >
              {t('checkout.paymentInstallment')}
            </button>
            {paymentMethod === 'installment_request' && (
              <p className="text-body-sm font-body-sm text-on-surface-variant px-space-md">{t('installment.disclaimer')}</p>
            )}
          </div>
        </section>

        <section>
          <h3 className="text-body-lg font-body-lg text-on-surface font-semibold mb-space-sm">{t('checkout.comment')}</h3>
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder={t('checkout.commentPlaceholder')}
            aria-label={t('checkout.comment')}
            className="w-full rounded-xl border border-outline-variant/40 bg-transparent px-space-md py-space-sm text-body-md font-body-md focus:outline-primary"
            rows={2}
          />
        </section>

        {totals !== null && (
          <section className="bg-surface-container rounded-xl p-space-md flex flex-col gap-space-xs">
            <div className="flex justify-between text-body-sm font-body-sm text-on-surface-variant">
              <span>{t('cart.itemsTotal')}</span>
              <span>{formatSom(totals.itemsTotal)}</span>
            </div>
            <div className="flex justify-between text-body-sm font-body-sm text-on-surface-variant">
              <span>{t('cart.delivery')}</span>
              <span>{totals.deliveryFee === 0 ? t('cart.deliveryFree') : formatSom(totals.deliveryFee)}</span>
            </div>
            <div className="flex justify-between text-body-lg font-body-lg text-on-surface font-semibold pt-space-xs border-t border-outline-variant/40">
              <span>{t('cart.grandTotal')}</span>
              <span>{formatSom(totals.grandTotal)}</span>
            </div>
          </section>
        )}

        {errorText !== null && <p className="text-body-sm font-body-sm text-error">{errorText}</p>}
      </main>

      <div className="fixed bottom-0 left-0 right-0 z-30 px-margin py-space-sm pb-safe bg-surface/95 backdrop-blur-xl border-t border-outline-variant/40">
        <button
          type="button"
          disabled={!canSubmit}
          onClick={() => void handleSubmit()}
          className="w-full h-12 rounded-full bg-primary text-on-primary text-label-lg font-label-lg disabled:opacity-50"
        >
          {submitting ? t('checkout.submitting') : t('checkout.submit')}
        </button>
      </div>
    </div>
  );
}

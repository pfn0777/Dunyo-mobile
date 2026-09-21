import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { useMe, useOrders } from '../lib/queries.ts';
import { getClient } from '../lib/client.ts';
import { config } from '../lib/config.ts';
import { openTelegramLink } from '../lib/telegram.ts';
import { formatSom } from '../lib/format.ts';
import { t } from '../lib/i18n.ts';
import { useTheme } from '../lib/theme.ts';
import pkg from '../../package.json';
import { isTerminal } from '../../../shared/src/orderStatus.ts';

const FAQ_ITEMS: Array<{ q: string; a: string }> = [
  { q: t('faq.delivery.q'), a: t('faq.delivery.a') },
  { q: t('faq.payment.q'), a: t('faq.payment.a') },
  { q: t('faq.warranty.q'), a: t('faq.warranty.a') },
  { q: t('faq.installment.q'), a: t('faq.installment.a') },
];

// Per spec: name, phone, orders, addresses, active-order card,
// warranty/support/channel links, app version. No cashback/VIP/nasiya
// limit/saved cards/live map/notification settings/"Hisobdan chiqish" —
// see spec's "Qamrov TASHQARISIDA" list; a Mini App has no session to log
// out of.
export function Profile(): JSX.Element {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: me } = useMe();
  const { data: orders } = useOrders();
  const [editOpen, setEditOpen] = useState(false);
  const [firstName, setFirstName] = useState('');
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  const activeOrder = orders?.items.find((o) => !isTerminal(o.status));

  const handleSave = async (): Promise<void> => {
    const client = await getClient();
    await client.patchMe({ firstName: firstName.trim().length > 0 ? firstName.trim() : undefined });
    await queryClient.invalidateQueries({ queryKey: ['me'] });
    setEditOpen(false);
  };

  const handleSupport = (): void => {
    if (config.supportUsername.length > 0) openTelegramLink(`https://t.me/${config.supportUsername}`);
  };

  const handleChannel = (): void => {
    if (config.channelUsername.length > 0) openTelegramLink(`https://t.me/${config.channelUsername}`);
  };

  return (
    <div className="flex flex-col min-h-screen pb-24">
      <header className="sticky top-0 z-30 bg-surface/90 backdrop-blur-xl pt-safe px-margin h-14 flex items-center shadow-sm">
        <h1 className="text-headline-md font-headline-md text-on-surface">{t('profile.title')}</h1>
      </header>

      <main className="px-margin pt-space-md flex flex-col gap-space-md">
        <section className="bg-surface-container rounded-xl p-space-md shadow-sm flex items-center justify-between">
          <div>
            <p className="text-body-lg font-body-lg text-on-surface font-semibold">
              {me?.first_name} {me?.last_name ?? ''}
            </p>
            <p className="text-body-sm font-body-sm text-on-surface-variant">{me?.phone ?? t('profile.noPhone')}</p>
          </div>
          <button
            type="button"
            onClick={() => {
              setFirstName(me?.first_name ?? '');
              setEditOpen(true);
            }}
            className="text-label-lg font-label-lg text-primary-text min-h-[44px]"
          >
            {t('profile.edit')}
          </button>
        </section>

        {activeOrder !== undefined && (
          <button
            type="button"
            onClick={() => navigate(`/profile/orders/${activeOrder.id}`)}
            className="bg-primary/10 rounded-xl p-space-md text-left"
          >
            <p className="text-label-sm font-label-sm text-primary-text mb-1">{t('profile.activeOrder')}</p>
            <p className="text-body-md font-body-md text-on-surface">
              {activeOrder.order_no} · {t(`status.${activeOrder.status}`)} · {formatSom(activeOrder.grand_total)}
            </p>
            {activeOrder.tracking_note !== null && (
              <p className="text-body-sm font-body-sm text-on-surface-variant mt-1">{activeOrder.tracking_note}</p>
            )}
          </button>
        )}

        <nav className="bg-surface-container rounded-xl shadow-sm divide-y divide-outline-variant/30">
          <ProfileRow icon="receipt_long" label={t('profile.myOrders')} onClick={() => navigate('/profile/orders')} />
          <ProfileRow icon="location_on" label={t('profile.myAddresses')} onClick={() => navigate('/profile/addresses')} />
          <ThemeRow />
          <ProfileRow icon="verified_user" label={t('profile.warranty')} onClick={() => setOpenFaq(2)} />
          <ProfileRow icon="support_agent" label={t('profile.support')} onClick={handleSupport} />
          {config.channelUsername.length > 0 && (
            <ProfileRow icon="send" label={t('profile.channel')} onClick={handleChannel} />
          )}
          {me?.is_admin === true && (
            <ProfileRow icon="admin_panel_settings" label={t('profile.admin')} onClick={() => navigate('/admin')} />
          )}
        </nav>

        <section className="bg-surface-container rounded-xl shadow-sm p-space-md">
          <h3 className="text-body-lg font-body-lg text-on-surface font-semibold mb-space-sm">{t('profile.faq')}</h3>
          <div className="flex flex-col divide-y divide-outline-variant/30">
            {FAQ_ITEMS.map((item, index) => (
              <div key={item.q} className="py-space-sm">
                <button
                  type="button"
                  onClick={() => setOpenFaq(openFaq === index ? null : index)}
                  className="w-full flex items-center justify-between text-left text-body-md font-body-md text-on-surface min-h-[44px]"
                >
                  {item.q}
                  <span className="material-symbols-outlined text-[18px]">{openFaq === index ? 'expand_less' : 'expand_more'}</span>
                </button>
                {openFaq === index && <p className="text-body-sm font-body-sm text-on-surface-variant mt-1">{item.a}</p>}
              </div>
            ))}
          </div>
        </section>

        <p className="text-label-sm font-label-sm text-on-surface-variant text-center">
          {t('profile.version')}: {(pkg as { version: string }).version}
        </p>
      </main>

      {editOpen && (
        <div className="fixed inset-0 z-50 flex items-end" role="dialog" aria-modal="true">
          <button type="button" aria-label={t('common.close')} className="absolute inset-0 bg-black/50" onClick={() => setEditOpen(false)} />
          <div className="relative w-full bg-surface-container-low rounded-t-2xl p-margin pb-safe">
            <h3 className="text-headline-md font-headline-md text-on-surface mb-space-md">{t('profile.edit')}</h3>
            <input
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              aria-label={t('checkout.name')}
              className="w-full h-11 rounded-xl border border-outline-variant/40 bg-transparent px-space-md text-body-md font-body-md mb-space-md focus:outline-primary"
            />
            <button type="button" onClick={() => void handleSave()} className="w-full h-11 rounded-full bg-primary text-on-primary text-label-lg font-label-lg">
              {t('profile.save')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function ThemeRow(): JSX.Element {
  const { theme, toggle } = useTheme();
  const isDark = theme === 'dark';
  return (
    <button
      type="button"
      role="switch"
      aria-checked={isDark}
      onClick={toggle}
      className="w-full flex items-center gap-space-md px-space-md min-h-[52px] text-left"
    >
      <span className="material-symbols-outlined text-[20px] text-on-surface-variant">{isDark ? 'dark_mode' : 'light_mode'}</span>
      <span className="flex-1 text-body-md font-body-md text-on-surface">{t('theme.title')}</span>
      <span className="text-body-sm font-body-sm text-on-surface-variant">{isDark ? t('theme.dark') : t('theme.light')}</span>
    </button>
  );
}

function ProfileRow({ icon, label, onClick }: { icon: string; label: string; onClick: () => void }): JSX.Element {
  return (
    <button type="button" onClick={onClick} className="w-full flex items-center gap-space-md px-space-md min-h-[52px] text-left">
      <span className="material-symbols-outlined text-[20px] text-on-surface-variant">{icon}</span>
      <span className="flex-1 text-body-md font-body-md text-on-surface">{label}</span>
      <span className="material-symbols-outlined text-[18px] text-on-surface-variant">chevron_right</span>
    </button>
  );
}

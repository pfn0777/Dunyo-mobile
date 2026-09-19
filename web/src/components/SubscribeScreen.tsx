import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { getClient } from '../lib/client.ts';
import { openTelegramLink } from '../lib/telegram.ts';
import { t } from '../lib/i18n.ts';

/** Blocking screen shown until the user joins the shop's Telegram channel. */
export function SubscribeScreen({ channelUsername }: { channelUsername: string | null }): JSX.Element {
  const queryClient = useQueryClient();
  const [checking, setChecking] = useState(false);
  const [stillMissing, setStillMissing] = useState(false);

  const handleOpenChannel = (): void => {
    if (channelUsername !== null) {
      openTelegramLink(`https://t.me/${channelUsername}`);
    }
  };

  const handleCheck = async (): Promise<void> => {
    setChecking(true);
    setStillMissing(false);
    try {
      const me = await (await getClient()).postChannelCheck();
      if (me.channel_required) {
        setStillMissing(true);
      }
      queryClient.setQueryData(['me'], me);
    } catch (error) {
      console.error('SubscribeScreen: channel check failed', error);
      setStillMissing(true);
    } finally {
      setChecking(false);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen px-margin text-center gap-space-md bg-surface">
      <span className="material-symbols-outlined text-[48px] text-primary">campaign</span>
      <p className="text-headline-md font-headline-md text-on-surface">{t('subscribe.title')}</p>
      <p className="text-body-md font-body-md text-on-surface-variant">{t('subscribe.text')}</p>
      {channelUsername !== null && (
        <button
          type="button"
          onClick={handleOpenChannel}
          className="min-h-[44px] px-space-lg py-space-sm rounded-full bg-primary text-on-primary text-label-lg font-label-lg"
        >
          {t('subscribe.openChannel')}
        </button>
      )}
      <button
        type="button"
        onClick={() => void handleCheck()}
        disabled={checking}
        className="min-h-[44px] px-space-lg py-space-sm rounded-full bg-surface-container text-on-surface text-label-lg font-label-lg disabled:opacity-50"
      >
        {checking ? t('common.loading') : t('subscribe.check')}
      </button>
      {stillMissing && <p className="text-body-sm font-body-sm text-error">{t('subscribe.notYet')}</p>}
    </div>
  );
}

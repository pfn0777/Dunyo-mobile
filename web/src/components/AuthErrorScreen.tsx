import { config } from '../lib/config.ts';
import { openTelegramLink } from '../lib/telegram.ts';
import { t } from '../lib/i18n.ts';

export function AuthErrorScreen(): JSX.Element {
  const handleOpenBot = (): void => {
    if (config.botUsername.length > 0) {
      openTelegramLink(`https://t.me/${config.botUsername}`);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen px-margin text-center gap-space-md bg-surface">
      <span className="material-symbols-outlined text-[48px] text-on-surface-variant">lock</span>
      <p className="text-headline-md font-headline-md text-on-surface">{t('auth.title')}</p>
      <button
        type="button"
        onClick={handleOpenBot}
        className="min-h-[44px] px-space-lg py-space-sm rounded-full bg-primary text-on-primary text-label-lg font-label-lg"
      >
        {t('auth.openBot')}
      </button>
    </div>
  );
}

import type { ReactNode } from 'react';
import { useLocation } from 'react-router-dom';
import { useTelegramBackButton } from '../../lib/useBackButton.ts';
import { adminParentPath } from '../adminParentPath.ts';
import { t } from '../../lib/i18n.ts';

/** Shared shell for every admin subpage: sticky header with a back control and
 * a title, and a max-width container so the panel stays usable on Telegram
 * Desktop's wide viewport while remaining mobile-first (full width, no side
 * padding waste) on phones. The bottom nav is hidden under /admin, so the back
 * control here is the only way out — it is rendered as a visible chevron *and*
 * wired to the Telegram BackButton, because the Telegram one is absent on some
 * clients. */
export function AdminPage({ title, actions, children }: { title: string; actions?: ReactNode; children: ReactNode }): JSX.Element {
  const { pathname } = useLocation();
  const goBack = useTelegramBackButton(adminParentPath(pathname));

  return (
    <div className="flex flex-col min-h-screen pb-24">
      <header className="sticky top-0 z-30 bg-surface-container-lowest/90 backdrop-blur-xl pt-safe px-space-lg h-14 flex items-center gap-space-sm shadow-sm">
        <button
          type="button"
          onClick={goBack}
          aria-label={t('common.back')}
          className="-ml-2 shrink-0 min-w-[44px] min-h-[44px] flex items-center justify-center text-on-surface-variant"
        >
          <span className="material-symbols-outlined">chevron_left</span>
        </button>
        <h1 className="text-title-md font-title-md text-on-surface truncate">{title}</h1>
        {actions !== undefined && <div className="ml-auto flex items-center">{actions}</div>}
      </header>
      <main className="w-full max-w-2xl mx-auto px-space-lg pt-space-md flex flex-col gap-space-md">{children}</main>
    </div>
  );
}

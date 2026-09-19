import { t } from '../../lib/i18n.ts';

/** Shown when /me says the caller isn't an admin, or any admin call comes
 * back 401/403. Convenience only — the server enforces the real check on
 * every /admin/* request regardless of what this screen shows. */
export function AccessDenied(): JSX.Element {
  return (
    <div className="flex flex-col items-center justify-center py-space-2xl px-space-lg text-center gap-space-sm">
      <span className="material-symbols-outlined text-[40px] text-error">lock</span>
      <p className="text-title-md font-title-md text-on-surface">{t('admin.accessDenied')}</p>
    </div>
  );
}

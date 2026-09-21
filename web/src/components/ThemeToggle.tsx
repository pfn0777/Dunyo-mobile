import { useTheme } from '../lib/theme.ts';
import { t } from '../lib/i18n.ts';

/** Round icon button for the Home header: shows the theme you would switch to. */
export function ThemeToggle(): JSX.Element {
  const { theme, toggle } = useTheme();
  const isDark = theme === 'dark';
  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={t('theme.toggle')}
      aria-pressed={isDark}
      className="shrink-0 w-11 h-11 rounded-full bg-surface-container-high text-on-surface flex items-center justify-center"
    >
      <span className="material-symbols-outlined text-[22px]">{isDark ? 'light_mode' : 'dark_mode'}</span>
    </button>
  );
}

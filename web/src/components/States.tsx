import { t } from '../lib/i18n.ts';

export function Skeleton({ className = '' }: { className?: string }): JSX.Element {
  return <div className={`animate-pulse bg-skeleton rounded-xl ${className}`} />;
}

export function ErrorState({ message, onRetry }: { message?: string; onRetry: () => void }): JSX.Element {
  return (
    <div className="flex flex-col items-center gap-space-sm py-space-xl text-center px-margin">
      <span className="material-symbols-outlined text-[36px] text-on-surface-variant">error_outline</span>
      <p className="text-body-md font-body-md text-on-surface-variant">{message ?? t('common.error')}</p>
      <button
        type="button"
        onClick={onRetry}
        className="min-h-[44px] px-space-lg rounded-xl bg-surface-container text-on-surface text-label-md font-label-md border border-outline/80 dark:border-0"
      >
        {t('common.retry')}
      </button>
    </div>
  );
}

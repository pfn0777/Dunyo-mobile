import { useState } from 'react';
import { AdminPage } from '../components/AdminPage.tsx';
import { AdminErrorState } from '../components/AdminErrorState.tsx';
import { Skeleton } from '../../components/States.tsx';
import { useAdminAudit } from '../queries.ts';
import { t } from '../../lib/i18n.ts';

const PAGE_SIZE = 20;

function diffKeys(before: Record<string, unknown> | null, after: Record<string, unknown> | null): string[] {
  const keys = new Set([...Object.keys(before ?? {}), ...Object.keys(after ?? {})]);
  return [...keys].filter((key) => JSON.stringify(before?.[key]) !== JSON.stringify(after?.[key]));
}

function short(value: unknown): string {
  if (value === undefined) return '—';
  const str = typeof value === 'string' ? value : JSON.stringify(value);
  return str.length > 30 ? `${str.slice(0, 30)}…` : str;
}

export function Audit(): JSX.Element {
  const [page, setPage] = useState(1);
  const { data, isLoading, isError, error, refetch } = useAdminAudit(page);

  return (
    <AdminPage title={t('admin.menu.audit')}>
      {isLoading ? (
        Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-16" />)
      ) : isError ? (
        <AdminErrorState error={error} onRetry={() => void refetch()} />
      ) : (data?.items.length ?? 0) === 0 ? (
        <p className="text-body-md font-body-md text-on-surface-variant text-center py-space-2xl">{t('admin.audit.empty')}</p>
      ) : (
        <>
          <div className="flex flex-col gap-space-sm">
            {data!.items.map((entry) => {
              const changed = diffKeys(entry.before, entry.after);
              return (
                <div key={entry.id} className="bg-surface-container-lowest rounded-2xl p-space-md shadow-sm flex flex-col gap-space-xs">
                  <div className="flex justify-between">
                    <p className="text-title-sm font-title-sm text-on-surface">{entry.action}</p>
                    <p className="text-body-sm font-body-sm text-on-surface-variant">
                      {new Date(entry.created_at).toLocaleString('uz-UZ', { timeZone: 'Asia/Tashkent' })}
                    </p>
                  </div>
                  <p className="text-body-sm font-body-sm text-on-surface-variant">
                    admin #{entry.admin_id ?? '—'} &middot; {entry.entity}
                    {entry.entity_id !== null ? ` #${entry.entity_id}` : ''}
                  </p>
                  {changed.length > 0 && (
                    <div className="flex flex-col gap-0.5">
                      {changed.map((key) => (
                        <p key={key} className="text-body-sm font-body-sm text-on-surface">
                          {key}: {short(entry.before?.[key])} {'→'} {short(entry.after?.[key])}
                        </p>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          <div className="flex items-center justify-between py-space-md">
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="min-h-[40px] px-space-md rounded-xl bg-surface-container text-on-surface text-label-md font-label-md disabled:opacity-40"
            >
              {t('admin.prev')}
            </button>
            <span className="text-body-sm font-body-sm text-on-surface-variant">{page}</span>
            <button
              type="button"
              disabled={page * PAGE_SIZE >= (data?.total ?? 0)}
              onClick={() => setPage((p) => p + 1)}
              className="min-h-[40px] px-space-md rounded-xl bg-surface-container text-on-surface text-label-md font-label-md disabled:opacity-40"
            >
              {t('admin.next')}
            </button>
          </div>
        </>
      )}
    </AdminPage>
  );
}

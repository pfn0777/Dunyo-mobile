import { useState } from 'react';
import { AdminPage } from '../components/AdminPage.tsx';
import { AdminErrorState } from '../components/AdminErrorState.tsx';
import { ConfirmDialog } from '../components/ConfirmDialog.tsx';
import { Skeleton } from '../../components/States.tsx';
import { useAddAdmin, useAdminUsers, useDeleteAdmin } from '../queries.ts';
import { t } from '../../lib/i18n.ts';
import { useToast } from '../../lib/toast.tsx';
import { ApiError } from '../../lib/apiError.ts';
import type { AdminUserRow } from '../types.ts';

/** Maps a delete-admin ApiError code to a readable Uzbek message. Every other
 * code (or a non-ApiError failure) falls back to the generic error string. */
function deleteErrorMessage(err: unknown): string {
  if (err instanceof ApiError) {
    if (err.code === 'cannot_delete_self') return t('admin.admins.errorCannotDeleteSelf');
    if (err.code === 'cannot_delete_last_owner') return t('admin.admins.errorCannotDeleteLastOwner');
  }
  return t('common.error');
}

export function Admins(): JSX.Element {
  const { data, isLoading, isError, error, refetch } = useAdminUsers();
  const addAdmin = useAddAdmin();
  const deleteAdmin = useDeleteAdmin();
  const toast = useToast();

  const [newId, setNewId] = useState('');
  const [addError, setAddError] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<AdminUserRow | null>(null);

  async function add(): Promise<void> {
    setAddError(null);
    const id = Number(newId.trim());
    if (!Number.isInteger(id) || id <= 0) {
      setAddError(t('admin.admins.errorId'));
      return;
    }
    try {
      await addAdmin.mutateAsync(id);
      toast.show(t('admin.admins.added'));
      setNewId('');
    } catch (err) {
      setAddError(err instanceof ApiError ? err.message : t('common.error'));
    }
  }

  async function confirmDelete(): Promise<void> {
    if (deleteTarget === null) return;
    try {
      await deleteAdmin.mutateAsync(deleteTarget.telegram_id);
      toast.show(t('admin.admins.deleted'));
      setDeleteTarget(null);
    } catch (err) {
      toast.show(deleteErrorMessage(err));
      setDeleteTarget(null);
    }
  }

  return (
    <AdminPage title={t('admin.menu.admins')}>
      <div className="flex gap-space-sm">
        <input
          value={newId}
          onChange={(e) => setNewId(e.target.value.replace(/\D/g, ''))}
          placeholder={t('admin.admins.telegramId')}
          inputMode="numeric"
          className="flex-1 min-h-[44px] px-space-md rounded-xl bg-surface-container text-on-surface text-body-md font-body-md"
        />
        <button
          type="button"
          disabled={addAdmin.isPending}
          onClick={() => void add()}
          className="min-h-[44px] px-space-lg rounded-xl bg-primary text-on-primary text-label-md font-label-md disabled:opacity-50"
        >
          {t('admin.admins.add')}
        </button>
      </div>
      {addError !== null && <p className="text-body-sm font-body-sm text-error">{addError}</p>}

      {isLoading ? (
        Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-14" />)
      ) : isError ? (
        <AdminErrorState error={error} onRetry={() => void refetch()} />
      ) : (
        <div className="flex flex-col gap-space-sm">
          {(data ?? []).map((admin) => (
            <div key={admin.telegram_id} className="bg-surface-container-lowest rounded-2xl p-space-md shadow-sm flex items-center justify-between">
              <div>
                <p className="text-title-sm font-title-sm text-on-surface">{admin.telegram_id}</p>
                <p className="text-body-sm font-body-sm text-on-surface-variant">{admin.role}</p>
              </div>
              <button
                type="button"
                onClick={() => setDeleteTarget(admin)}
                className="min-h-[36px] px-space-sm text-error text-label-md font-label-md"
              >
                {t('admin.products.delete')}
              </button>
            </div>
          ))}
        </div>
      )}

      {deleteTarget !== null && (
        <ConfirmDialog
          message={t('admin.admins.deleteConfirm', { id: String(deleteTarget.telegram_id) })}
          danger
          pending={deleteAdmin.isPending}
          onCancel={() => setDeleteTarget(null)}
          onConfirm={() => void confirmDelete()}
        />
      )}
    </AdminPage>
  );
}

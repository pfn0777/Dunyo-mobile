import { useState } from 'react';
import { AdminPage } from '../components/AdminPage.tsx';
import { AdminErrorState } from '../components/AdminErrorState.tsx';
import { ConfirmDialog } from '../components/ConfirmDialog.tsx';
import { Skeleton } from '../../components/States.tsx';
import { useAdminBrands, useCreateBrand, useDeleteBrand, useUpdateBrand } from '../queries.ts';
import { t } from '../../lib/i18n.ts';
import { useToast } from '../../lib/toast.tsx';
import type { AdminBrand } from '../types.ts';

interface EditState {
  id: number | null;
  name: string;
  sortOrder: number;
  isActive: boolean;
}

const EMPTY: EditState = { id: null, name: '', sortOrder: 0, isActive: true };

export function Brands(): JSX.Element {
  const { data, isLoading, isError, error, refetch } = useAdminBrands();
  const create = useCreateBrand();
  const update = useUpdateBrand();
  const del = useDeleteBrand();
  const toast = useToast();

  const [edit, setEdit] = useState<EditState | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<AdminBrand | null>(null);

  function startEdit(brand?: AdminBrand): void {
    setEdit(brand === undefined ? EMPTY : { id: brand.id, name: brand.name, sortOrder: brand.sort_order, isActive: brand.is_active });
  }

  async function save(): Promise<void> {
    if (edit === null || edit.name.trim().length === 0) return;
    const input = { name: edit.name.trim(), sortOrder: edit.sortOrder, isActive: edit.isActive };
    if (edit.id === null) {
      await create.mutateAsync(input);
    } else {
      await update.mutateAsync({ id: edit.id, input });
    }
    toast.show(t('admin.brands.saved'));
    setEdit(null);
  }

  async function confirmDelete(): Promise<void> {
    if (deleteTarget === null) return;
    await del.mutateAsync(deleteTarget.id);
    toast.show(t('admin.brands.deleted'));
    setDeleteTarget(null);
  }

  return (
    <AdminPage
      title={t('admin.menu.brands')}
      actions={
        <button
          type="button"
          onClick={() => startEdit()}
          className="min-h-[36px] px-space-md rounded-full bg-primary text-on-primary text-label-md font-label-md"
        >
          {t('admin.brands.add')}
        </button>
      }
    >
      {isLoading ? (
        Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-16" />)
      ) : isError ? (
        <AdminErrorState error={error} onRetry={() => void refetch()} />
      ) : (
        <div className="flex flex-col gap-space-sm">
          {(data ?? []).map((brand) => (
            <div key={brand.id} className="bg-surface-container-lowest rounded-2xl p-space-md shadow-sm flex items-center gap-space-sm">
              <div className="flex-1 min-w-0">
                <p className="text-title-sm font-title-sm text-on-surface truncate">
                  {brand.name} {brand.is_active ? '' : `(${t('admin.products.inactive')})`}
                </p>
                <p className="text-body-sm font-body-sm text-on-surface-variant">{t('admin.categories.sortOrder')}: {brand.sort_order}</p>
              </div>
              <button type="button" onClick={() => startEdit(brand)} className="min-h-[36px] px-space-sm text-primary text-label-md font-label-md">
                {t('admin.edit')}
              </button>
              <button type="button" onClick={() => setDeleteTarget(brand)} className="min-h-[36px] px-space-sm text-error text-label-md font-label-md">
                {t('admin.products.delete')}
              </button>
            </div>
          ))}
        </div>
      )}

      {edit !== null && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 px-space-lg">
          <div className="bg-surface-container-lowest rounded-2xl p-space-lg w-full max-w-sm shadow-lg flex flex-col gap-space-md">
            <input
              value={edit.name}
              onChange={(e) => setEdit({ ...edit, name: e.target.value })}
              placeholder={t('admin.brands.name')}
              className="min-h-[44px] px-space-md rounded-xl bg-surface-container text-on-surface text-body-md font-body-md"
            />
            <input
              type="number"
              inputMode="numeric"
              value={edit.sortOrder}
              onChange={(e) => setEdit({ ...edit, sortOrder: Number(e.target.value) })}
              placeholder={t('admin.categories.sortOrder')}
              className="min-h-[44px] px-space-md rounded-xl bg-surface-container text-on-surface text-body-md font-body-md"
            />
            <label className="flex items-center gap-space-sm">
              <input type="checkbox" checked={edit.isActive} onChange={(e) => setEdit({ ...edit, isActive: e.target.checked })} className="w-5 h-5" />
              <span className="text-body-md font-body-md text-on-surface">{t('admin.products.active')}</span>
            </label>
            <div className="flex gap-space-sm justify-end">
              <button type="button" onClick={() => setEdit(null)} className="min-h-[44px] px-space-lg rounded-xl bg-surface-container text-on-surface text-label-md font-label-md">
                {t('common.cancel')}
              </button>
              <button
                type="button"
                disabled={create.isPending || update.isPending}
                onClick={() => void save()}
                className="min-h-[44px] px-space-lg rounded-xl bg-primary text-on-primary text-label-md font-label-md disabled:opacity-50"
              >
                {t('profile.save')}
              </button>
            </div>
          </div>
        </div>
      )}

      {deleteTarget !== null && (
        <ConfirmDialog
          message={t('admin.brands.deleteConfirm', { name: deleteTarget.name })}
          danger
          pending={del.isPending}
          onCancel={() => setDeleteTarget(null)}
          onConfirm={() => void confirmDelete()}
        />
      )}
    </AdminPage>
  );
}

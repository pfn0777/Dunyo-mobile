import { useState } from 'react';
import { AdminPage } from '../components/AdminPage.tsx';
import { AdminErrorState } from '../components/AdminErrorState.tsx';
import { ConfirmDialog } from '../components/ConfirmDialog.tsx';
import { Skeleton } from '../../components/States.tsx';
import { useAdminRegions, useCreateRegion, useDeleteRegion, useUpdateRegion } from '../queries.ts';
import { formatSom } from '../../lib/format.ts';
import { t } from '../../lib/i18n.ts';
import { useToast } from '../../lib/toast.tsx';
import type { AdminRegion } from '../types.ts';

interface EditState {
  id: number | null;
  name: string;
  deliveryFee: string;
  etaText: string;
  /** Blank means "inherit settings.free_delivery_threshold" — see db/migrations/0001_init.sql. */
  freeDeliveryThreshold: string;
  sortOrder: number;
  isActive: boolean;
}

const EMPTY: EditState = { id: null, name: '', deliveryFee: '0', etaText: '', freeDeliveryThreshold: '', sortOrder: 0, isActive: true };

export function Regions(): JSX.Element {
  const { data, isLoading, isError, error, refetch } = useAdminRegions();
  const create = useCreateRegion();
  const update = useUpdateRegion();
  const del = useDeleteRegion();
  const toast = useToast();

  const [edit, setEdit] = useState<EditState | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<AdminRegion | null>(null);

  function startEdit(region?: AdminRegion): void {
    setEdit(
      region === undefined
        ? EMPTY
        : {
            id: region.id,
            name: region.name,
            deliveryFee: String(region.delivery_fee),
            etaText: region.eta_text ?? '',
            freeDeliveryThreshold: region.free_delivery_threshold !== null ? String(region.free_delivery_threshold) : '',
            sortOrder: region.sort_order,
            isActive: region.is_active,
          },
    );
  }

  async function save(): Promise<void> {
    if (edit === null || edit.name.trim().length === 0) return;
    const input = {
      name: edit.name.trim(),
      deliveryFee: Number(edit.deliveryFee) || 0,
      etaText: edit.etaText.trim().length > 0 ? edit.etaText.trim() : null,
      freeDeliveryThreshold: edit.freeDeliveryThreshold.trim().length > 0 ? Number(edit.freeDeliveryThreshold) : null,
      sortOrder: edit.sortOrder,
      isActive: edit.isActive,
    };
    if (edit.id === null) {
      await create.mutateAsync(input);
    } else {
      await update.mutateAsync({ id: edit.id, input });
    }
    toast.show(t('admin.regions.saved'));
    setEdit(null);
  }

  async function confirmDelete(): Promise<void> {
    if (deleteTarget === null) return;
    await del.mutateAsync(deleteTarget.id);
    toast.show(t('admin.regions.deleted'));
    setDeleteTarget(null);
  }

  return (
    <AdminPage
      title={t('admin.menu.regions')}
      actions={
        <button
          type="button"
          onClick={() => startEdit()}
          className="min-h-[36px] px-space-md rounded-full bg-primary text-on-primary text-label-md font-label-md"
        >
          {t('admin.regions.add')}
        </button>
      }
    >
      {isLoading ? (
        Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-16" />)
      ) : isError ? (
        <AdminErrorState error={error} onRetry={() => void refetch()} />
      ) : (
        <div className="flex flex-col gap-space-sm">
          {(data ?? []).map((region) => (
            <div key={region.id} className="bg-surface-container-lowest rounded-2xl p-space-md shadow-sm flex items-center gap-space-sm">
              <div className="flex-1 min-w-0">
                <p className="text-title-sm font-title-sm text-on-surface truncate">
                  {region.name} {region.is_active ? '' : `(${t('admin.products.inactive')})`}
                </p>
                <p className="text-body-sm font-body-sm text-on-surface-variant">
                  {formatSom(region.delivery_fee)}
                  {region.eta_text !== null ? ` · ${region.eta_text}` : ''}
                  {region.free_delivery_threshold !== null
                    ? ` · ${t('admin.regions.freeDeliveryThreshold')}: ${formatSom(region.free_delivery_threshold)}`
                    : ` · ${t('admin.regions.freeDeliveryInherit')}`}
                </p>
              </div>
              <button type="button" onClick={() => startEdit(region)} className="min-h-[36px] px-space-sm text-primary text-label-md font-label-md">
                {t('admin.edit')}
              </button>
              <button type="button" onClick={() => setDeleteTarget(region)} className="min-h-[36px] px-space-sm text-error text-label-md font-label-md">
                {t('admin.products.delete')}
              </button>
            </div>
          ))}
        </div>
      )}

      {edit !== null && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 px-space-lg overflow-y-auto py-space-lg">
          <div className="bg-surface-container-lowest rounded-2xl p-space-lg w-full max-w-sm shadow-lg flex flex-col gap-space-md">
            <input
              value={edit.name}
              onChange={(e) => setEdit({ ...edit, name: e.target.value })}
              placeholder={t('admin.regions.name')}
              className="min-h-[44px] px-space-md rounded-xl bg-surface-container text-on-surface text-body-md font-body-md"
            />
            <label className="flex flex-col gap-space-xs">
              <span className="text-label-md font-label-md text-on-surface-variant">{t('admin.regions.deliveryFee')}</span>
              <input
                inputMode="numeric"
                value={edit.deliveryFee}
                onChange={(e) => setEdit({ ...edit, deliveryFee: e.target.value.replace(/\D/g, '') })}
                className="min-h-[44px] px-space-md rounded-xl bg-surface-container text-on-surface text-body-md font-body-md"
              />
            </label>
            <label className="flex flex-col gap-space-xs">
              <span className="text-label-md font-label-md text-on-surface-variant">{t('admin.regions.etaText')}</span>
              <input
                value={edit.etaText}
                onChange={(e) => setEdit({ ...edit, etaText: e.target.value })}
                placeholder="1-2 kun"
                className="min-h-[44px] px-space-md rounded-xl bg-surface-container text-on-surface text-body-md font-body-md"
              />
            </label>
            <label className="flex flex-col gap-space-xs">
              <span className="text-label-md font-label-md text-on-surface-variant">{t('admin.regions.freeDeliveryThreshold')}</span>
              <input
                inputMode="numeric"
                value={edit.freeDeliveryThreshold}
                onChange={(e) => setEdit({ ...edit, freeDeliveryThreshold: e.target.value.replace(/\D/g, '') })}
                className="min-h-[44px] px-space-md rounded-xl bg-surface-container text-on-surface text-body-md font-body-md"
              />
              <span className="text-body-sm font-body-sm text-on-surface-variant">{t('admin.regions.freeDeliveryThresholdHint')}</span>
            </label>
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
          message={t('admin.regions.deleteConfirm', { name: deleteTarget.name })}
          danger
          pending={del.isPending}
          onCancel={() => setDeleteTarget(null)}
          onConfirm={() => void confirmDelete()}
        />
      )}
    </AdminPage>
  );
}

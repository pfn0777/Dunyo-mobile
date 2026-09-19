import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { AdminPage } from '../components/AdminPage.tsx';
import { AdminErrorState } from '../components/AdminErrorState.tsx';
import { ConfirmDialog } from '../components/ConfirmDialog.tsx';
import { ImageUpload } from '../components/ImageUpload.tsx';
import { Skeleton } from '../../components/States.tsx';
import {
  useAdminProduct,
  useAdminVariants,
  useCreateVariant,
  useDeleteVariant,
  useUpdateVariant,
  useUploadVariantImage,
} from '../queries.ts';
import { formatSom } from '../../lib/format.ts';
import { mediaUrl } from '../../lib/config.ts';
import { t } from '../../lib/i18n.ts';
import { useToast } from '../../lib/toast.tsx';
import type { AdminVariant, VariantFormInput } from '../types.ts';

interface EditState {
  id: number | null;
  colorName: string;
  colorHex: string;
  storageGb: string;
  price: string;
  oldPrice: string;
  stock: string;
  sku: string;
  sortOrder: string;
  isActive: boolean;
}

const EMPTY: EditState = {
  id: null,
  colorName: '',
  colorHex: '#888888',
  storageGb: '',
  price: '',
  oldPrice: '',
  stock: '0',
  sku: '',
  sortOrder: '0',
  isActive: true,
};

interface FieldErrors {
  colorName?: string;
  price?: string;
  oldPrice?: string;
  stock?: string;
}

function validate(input: { colorName: string; price: string; oldPrice: string; stock: string }): FieldErrors {
  const errors: FieldErrors = {};
  if (input.colorName.trim().length === 0) errors.colorName = t('admin.variants.errorColorName');

  const price = Number(input.price);
  if (!Number.isInteger(price) || price <= 0) errors.price = t('admin.variants.errorPrice');

  if (input.oldPrice.trim().length > 0) {
    const oldPrice = Number(input.oldPrice);
    if (!Number.isInteger(oldPrice) || oldPrice <= price) errors.oldPrice = t('admin.variants.errorOldPrice');
  }

  const stock = Number(input.stock);
  if (!Number.isInteger(stock) || stock < 0) errors.stock = t('admin.variants.errorStock');

  return errors;
}

export function VariantsList(): JSX.Element {
  const { id } = useParams<{ id: string }>();
  const productId = Number(id);

  const { data: product } = useAdminProduct(Number.isFinite(productId) ? productId : null);
  const { data: variants, isLoading, isError, error, refetch } = useAdminVariants(Number.isFinite(productId) ? productId : null);
  const create = useCreateVariant(productId);
  const update = useUpdateVariant(productId);
  const del = useDeleteVariant(productId);
  const uploadImage = useUploadVariantImage(productId);
  const toast = useToast();

  const [edit, setEdit] = useState<EditState | null>(null);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [deleteTarget, setDeleteTarget] = useState<AdminVariant | null>(null);

  const activeCount = (variants ?? []).filter((v) => v.is_active).length;

  function startEdit(variant?: AdminVariant): void {
    setErrors({});
    setEdit(
      variant === undefined
        ? EMPTY
        : {
            id: variant.id,
            colorName: variant.color_name,
            colorHex: variant.color_hex ?? '#888888',
            storageGb: variant.storage_gb !== null ? String(variant.storage_gb) : '',
            price: String(variant.price),
            oldPrice: variant.old_price !== null ? String(variant.old_price) : '',
            stock: String(variant.stock),
            sku: variant.sku ?? '',
            sortOrder: String(variant.sort_order),
            isActive: variant.is_active,
          },
    );
  }

  async function save(): Promise<void> {
    if (edit === null) return;
    const fieldErrors = validate({ colorName: edit.colorName, price: edit.price, oldPrice: edit.oldPrice, stock: edit.stock });
    setErrors(fieldErrors);
    if (Object.keys(fieldErrors).length > 0) return;

    const input: VariantFormInput = {
      sku: edit.sku.trim().length > 0 ? edit.sku.trim() : null,
      colorName: edit.colorName.trim(),
      colorHex: edit.colorHex,
      storageGb: edit.storageGb.trim().length > 0 ? Number(edit.storageGb) : null,
      price: Number(edit.price),
      oldPrice: edit.oldPrice.trim().length > 0 ? Number(edit.oldPrice) : null,
      stock: Number(edit.stock),
      sortOrder: Number(edit.sortOrder) || 0,
      isActive: edit.isActive,
    };

    if (edit.id === null) {
      await create.mutateAsync(input);
    } else {
      await update.mutateAsync({ id: edit.id, input });
    }
    toast.show(t('admin.variants.saved'));
    setEdit(null);
  }

  async function confirmDelete(): Promise<void> {
    if (deleteTarget === null) return;
    await del.mutateAsync(deleteTarget.id);
    toast.show(t('admin.variants.deleted'));
    setDeleteTarget(null);
  }

  const isLastActiveVariant = deleteTarget !== null && deleteTarget.is_active && activeCount <= 1;

  return (
    <AdminPage
      title={product !== undefined ? `${t('admin.variants.title')} — ${product.name}` : t('admin.variants.title')}
      actions={
        <button
          type="button"
          onClick={() => startEdit()}
          className="min-h-[36px] px-space-md rounded-full bg-primary text-on-primary text-label-md font-label-md"
        >
          {t('admin.variants.add')}
        </button>
      }
    >
      {activeCount === 0 && !isLoading && !isError && (
        <div className="bg-error-container/40 rounded-xl p-space-md">
          <p className="text-body-sm font-body-sm text-on-surface">{t('admin.products.noActiveVariantWarning')}</p>
        </div>
      )}

      {isLoading ? (
        Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-20" />)
      ) : isError ? (
        <AdminErrorState error={error} onRetry={() => void refetch()} />
      ) : (variants?.length ?? 0) === 0 ? (
        <p className="text-body-md font-body-md text-on-surface-variant text-center py-space-2xl">{t('admin.variants.empty')}</p>
      ) : (
        <div className="flex flex-col gap-space-sm">
          {variants!.map((variant) => (
            <div key={variant.id} className="bg-surface-container-lowest rounded-2xl p-space-md shadow-sm flex items-center gap-space-sm">
              <div className="w-12 h-12 rounded-xl overflow-hidden flex-shrink-0 border border-outline-variant" style={{ backgroundColor: variant.color_hex ?? '#888888' }}>
                {mediaUrl(variant.image_thumb_path) !== null && (
                  <img src={mediaUrl(variant.image_thumb_path)!} alt="" className="w-full h-full object-cover" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-title-sm font-title-sm text-on-surface truncate">
                  {variant.color_name}
                  {variant.storage_gb !== null ? ` · ${variant.storage_gb} GB` : ''}
                  {!variant.is_active ? ` (${t('admin.products.inactive')})` : ''}
                </p>
                <p className="text-body-sm font-body-sm text-on-surface-variant">
                  {formatSom(variant.price)} &middot; {t('admin.variants.stock')}: {variant.stock}
                </p>
              </div>
              <button type="button" onClick={() => startEdit(variant)} className="min-h-[36px] px-space-sm text-primary text-label-md font-label-md">
                {t('admin.edit')}
              </button>
              <button type="button" onClick={() => setDeleteTarget(variant)} className="min-h-[36px] px-space-sm text-error text-label-md font-label-md">
                {t('admin.products.delete')}
              </button>
            </div>
          ))}
        </div>
      )}

      {edit !== null && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 px-space-lg overflow-y-auto py-space-lg">
          <div className="bg-surface-container-lowest rounded-2xl p-space-lg w-full max-w-sm shadow-lg flex flex-col gap-space-md">
            <label className="flex flex-col gap-space-xs">
              <span className="text-label-md font-label-md text-on-surface-variant">{t('admin.variants.colorName')}</span>
              <input
                value={edit.colorName}
                onChange={(e) => setEdit({ ...edit, colorName: e.target.value })}
                className="min-h-[44px] px-space-md rounded-xl bg-surface-container text-on-surface text-body-md font-body-md"
              />
              {errors.colorName !== undefined && <span className="text-body-sm font-body-sm text-error">{errors.colorName}</span>}
            </label>

            <label className="flex items-center gap-space-md">
              <span className="text-label-md font-label-md text-on-surface-variant">{t('admin.variants.colorHex')}</span>
              <input
                type="color"
                value={edit.colorHex}
                onChange={(e) => setEdit({ ...edit, colorHex: e.target.value })}
                className="w-10 h-10 rounded-lg bg-surface-container"
              />
            </label>

            <label className="flex flex-col gap-space-xs">
              <span className="text-label-md font-label-md text-on-surface-variant">{t('admin.variants.storageGb')}</span>
              <input
                inputMode="numeric"
                value={edit.storageGb}
                onChange={(e) => setEdit({ ...edit, storageGb: e.target.value.replace(/\D/g, '') })}
                placeholder={t('admin.variants.storageGbHint')}
                className="min-h-[44px] px-space-md rounded-xl bg-surface-container text-on-surface text-body-md font-body-md"
              />
            </label>

            <div className="grid grid-cols-2 gap-space-md">
              <label className="flex flex-col gap-space-xs">
                <span className="text-label-md font-label-md text-on-surface-variant">{t('admin.variants.price')}</span>
                <input
                  inputMode="numeric"
                  value={edit.price}
                  onChange={(e) => setEdit({ ...edit, price: e.target.value.replace(/\D/g, '') })}
                  className="min-h-[44px] px-space-md rounded-xl bg-surface-container text-on-surface text-body-md font-body-md"
                />
                {errors.price !== undefined && <span className="text-body-sm font-body-sm text-error">{errors.price}</span>}
              </label>
              <label className="flex flex-col gap-space-xs">
                <span className="text-label-md font-label-md text-on-surface-variant">{t('admin.variants.oldPrice')}</span>
                <input
                  inputMode="numeric"
                  value={edit.oldPrice}
                  onChange={(e) => setEdit({ ...edit, oldPrice: e.target.value.replace(/\D/g, '') })}
                  className="min-h-[44px] px-space-md rounded-xl bg-surface-container text-on-surface text-body-md font-body-md"
                />
                {errors.oldPrice !== undefined && <span className="text-body-sm font-body-sm text-error">{errors.oldPrice}</span>}
              </label>
            </div>

            <div className="grid grid-cols-2 gap-space-md">
              <label className="flex flex-col gap-space-xs">
                <span className="text-label-md font-label-md text-on-surface-variant">{t('admin.variants.stock')}</span>
                <input
                  inputMode="numeric"
                  value={edit.stock}
                  onChange={(e) => setEdit({ ...edit, stock: e.target.value.replace(/\D/g, '') })}
                  className="min-h-[44px] px-space-md rounded-xl bg-surface-container text-on-surface text-body-md font-body-md"
                />
                {errors.stock !== undefined && <span className="text-body-sm font-body-sm text-error">{errors.stock}</span>}
              </label>
              <label className="flex flex-col gap-space-xs">
                <span className="text-label-md font-label-md text-on-surface-variant">{t('admin.variants.sku')}</span>
                <input
                  value={edit.sku}
                  onChange={(e) => setEdit({ ...edit, sku: e.target.value })}
                  className="min-h-[44px] px-space-md rounded-xl bg-surface-container text-on-surface text-body-md font-body-md"
                />
              </label>
            </div>

            <label className="flex flex-col gap-space-xs">
              <span className="text-label-md font-label-md text-on-surface-variant">{t('admin.variants.sortOrder')}</span>
              <input
                inputMode="numeric"
                value={edit.sortOrder}
                onChange={(e) => setEdit({ ...edit, sortOrder: e.target.value.replace(/[^\d-]/g, '') })}
                className="min-h-[44px] px-space-md rounded-xl bg-surface-container text-on-surface text-body-md font-body-md"
              />
            </label>

            <label className="flex items-center gap-space-sm">
              <input type="checkbox" checked={edit.isActive} onChange={(e) => setEdit({ ...edit, isActive: e.target.checked })} className="w-5 h-5" />
              <span className="text-body-md font-body-md text-on-surface">{t('admin.products.active')}</span>
            </label>

            {edit.id !== null && (
              <ImageUpload
                currentUrl={mediaUrl(variants?.find((v) => v.id === edit.id)?.image_path ?? null)}
                pending={uploadImage.isPending}
                onUpload={async (thumb, main) => {
                  await uploadImage.mutateAsync({ id: edit.id as number, thumb, main });
                  toast.show(t('admin.image.uploaded'));
                }}
              />
            )}

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
          message={isLastActiveVariant ? t('admin.variants.deleteLastActiveConfirm') : t('admin.variants.deleteConfirm')}
          danger
          pending={del.isPending}
          onCancel={() => setDeleteTarget(null)}
          onConfirm={() => void confirmDelete()}
        />
      )}
    </AdminPage>
  );
}

import { useState } from 'react';
import { AdminPage } from '../components/AdminPage.tsx';
import { AdminErrorState } from '../components/AdminErrorState.tsx';
import { ConfirmDialog } from '../components/ConfirmDialog.tsx';
import { ImageUpload } from '../components/ImageUpload.tsx';
import { Skeleton } from '../../components/States.tsx';
import {
  useAdminBanners,
  useAdminCategories,
  useCreateBanner,
  useDeleteBanner,
  useUpdateBanner,
  useUploadBannerImage,
} from '../queries.ts';
import { t } from '../../lib/i18n.ts';
import { useToast } from '../../lib/toast.tsx';
import { mediaUrl } from '../../lib/config.ts';
import type { AdminBanner } from '../types.ts';

interface EditState {
  id: number | null;
  title: string;
  subtitle: string;
  linkCategoryId: number | null;
  sortOrder: number;
  isActive: boolean;
  imagePath: string | null;
}

const EMPTY: EditState = { id: null, title: '', subtitle: '', linkCategoryId: null, sortOrder: 0, isActive: true, imagePath: null };

// A banner's image_path is null until the image-upload step completes (the
// server never accepts image_path on create/patch — see adminApi.ts). A
// null path also means the banner is invisible to customers (public banner
// reads filter on image_path is not null).
export function Banners(): JSX.Element {
  const { data, isLoading, isError, error, refetch } = useAdminBanners();
  const { data: categories } = useAdminCategories();
  const create = useCreateBanner();
  const update = useUpdateBanner();
  const del = useDeleteBanner();
  const uploadImage = useUploadBannerImage();
  const toast = useToast();

  const [edit, setEdit] = useState<EditState | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<AdminBanner | null>(null);

  function startEdit(banner?: AdminBanner): void {
    setEdit(
      banner === undefined
        ? EMPTY
        : {
            id: banner.id,
            title: banner.title ?? '',
            subtitle: banner.subtitle ?? '',
            linkCategoryId: banner.link_type === 'category' ? banner.link_id : null,
            sortOrder: banner.sort_order,
            isActive: banner.is_active,
            imagePath: banner.image_path,
          },
    );
  }

  async function save(): Promise<void> {
    if (edit === null) return;
    const input = {
      title: edit.title.trim().length > 0 ? edit.title.trim() : null,
      subtitle: edit.subtitle.trim().length > 0 ? edit.subtitle.trim() : null,
      linkType: edit.linkCategoryId !== null ? 'category' : null,
      linkId: edit.linkCategoryId,
      sortOrder: edit.sortOrder,
      isActive: edit.isActive,
    };
    if (edit.id === null) {
      const created = await create.mutateAsync(input);
      setEdit({ ...edit, id: created.id, imagePath: created.image_path });
    } else {
      await update.mutateAsync({ id: edit.id, input });
      toast.show(t('admin.banners.saved'));
      setEdit(null);
    }
  }

  async function confirmDelete(): Promise<void> {
    if (deleteTarget === null) return;
    await del.mutateAsync(deleteTarget.id);
    toast.show(t('admin.banners.deleted'));
    setDeleteTarget(null);
  }

  return (
    <AdminPage
      title={t('admin.menu.banners')}
      actions={
        <button
          type="button"
          onClick={() => startEdit()}
          className="min-h-[36px] px-space-md rounded-full bg-primary text-on-primary text-label-md font-label-md"
        >
          {t('admin.banners.add')}
        </button>
      }
    >
      {isLoading ? (
        Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-20" />)
      ) : isError ? (
        <AdminErrorState error={error} onRetry={() => void refetch()} />
      ) : (
        <div className="flex flex-col gap-space-sm">
          {(data ?? []).map((banner) => (
            <div key={banner.id} className="bg-surface-container-lowest rounded-2xl p-space-md shadow-sm flex items-center gap-space-sm">
              <div className="w-16 h-16 rounded-xl bg-surface-container overflow-hidden flex-shrink-0">
                {mediaUrl(banner.image_path) !== null && (
                  <img src={mediaUrl(banner.image_path)!} alt="" className="w-full h-full object-cover" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-title-sm font-title-sm text-on-surface truncate">
                  {banner.title ?? '—'} {banner.is_active ? '' : `(${t('admin.products.inactive')})`}
                </p>
                <p className="text-body-sm font-body-sm text-on-surface-variant truncate">{banner.subtitle}</p>
                {banner.image_path === null && (
                  <span className="inline-block mt-space-xs text-body-sm font-body-sm text-error bg-error-container/40 rounded-full px-space-sm py-0.5">
                    {t('admin.banners.noImage')}
                  </span>
                )}
              </div>
              <button type="button" onClick={() => startEdit(banner)} className="min-h-[36px] px-space-sm text-primary text-label-md font-label-md">
                {t('admin.edit')}
              </button>
              <button type="button" onClick={() => setDeleteTarget(banner)} className="min-h-[36px] px-space-sm text-error text-label-md font-label-md">
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
              value={edit.title}
              onChange={(e) => setEdit({ ...edit, title: e.target.value })}
              placeholder={t('admin.banners.title')}
              className="min-h-[44px] px-space-md rounded-xl bg-surface-container text-on-surface text-body-md font-body-md"
            />
            <input
              value={edit.subtitle}
              onChange={(e) => setEdit({ ...edit, subtitle: e.target.value })}
              placeholder={t('admin.banners.subtitle')}
              className="min-h-[44px] px-space-md rounded-xl bg-surface-container text-on-surface text-body-md font-body-md"
            />
            <select
              value={edit.linkCategoryId ?? ''}
              onChange={(e) => setEdit({ ...edit, linkCategoryId: e.target.value.length > 0 ? Number(e.target.value) : null })}
              className="min-h-[44px] px-space-md rounded-xl bg-surface-container text-on-surface text-body-md font-body-md"
            >
              <option value="">{t('admin.banners.noLink')}</option>
              {(categories ?? []).map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
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

            {edit.id !== null && (
              <ImageUpload
                currentUrl={mediaUrl(edit.imagePath)}
                pending={uploadImage.isPending}
                onUpload={async (_thumb, main) => {
                  const banner = await uploadImage.mutateAsync({ id: edit.id as number, image: main });
                  setEdit({ ...edit, imagePath: banner.image_path });
                  toast.show(t('admin.image.uploaded'));
                }}
              />
            )}

            <div className="flex gap-space-sm justify-end">
              <button type="button" onClick={() => setEdit(null)} className="min-h-[44px] px-space-lg rounded-xl bg-surface-container text-on-surface text-label-md font-label-md">
                {t('common.close')}
              </button>
              {edit.id === null && (
                <button
                  type="button"
                  disabled={create.isPending}
                  onClick={() => void save()}
                  className="min-h-[44px] px-space-lg rounded-xl bg-primary text-on-primary text-label-md font-label-md disabled:opacity-50"
                >
                  {t('admin.banners.createThenUpload')}
                </button>
              )}
              {edit.id !== null && (
                <button
                  type="button"
                  disabled={update.isPending}
                  onClick={() => void save()}
                  className="min-h-[44px] px-space-lg rounded-xl bg-primary text-on-primary text-label-md font-label-md disabled:opacity-50"
                >
                  {t('profile.save')}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {deleteTarget !== null && (
        <ConfirmDialog
          message={t('admin.banners.deleteConfirm')}
          danger
          pending={del.isPending}
          onCancel={() => setDeleteTarget(null)}
          onConfirm={() => void confirmDelete()}
        />
      )}
    </AdminPage>
  );
}

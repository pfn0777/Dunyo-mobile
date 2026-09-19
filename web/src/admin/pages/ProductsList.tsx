import { useState } from 'react';
import { Link } from 'react-router-dom';
import { AdminPage } from '../components/AdminPage.tsx';
import { AdminErrorState } from '../components/AdminErrorState.tsx';
import { ConfirmDialog } from '../components/ConfirmDialog.tsx';
import { Skeleton } from '../../components/States.tsx';
import { useAdminBrands, useAdminCategories, useAdminProducts, useDeleteProduct } from '../queries.ts';
import { t } from '../../lib/i18n.ts';
import { useToast } from '../../lib/toast.tsx';
import type { AdminProduct } from '../types.ts';

const PAGE_SIZE = 20;

export function ProductsList(): JSX.Element {
  const [q, setQ] = useState('');
  const [brandId, setBrandId] = useState<number | undefined>(undefined);
  const [categoryId, setCategoryId] = useState<number | undefined>(undefined);
  const [page, setPage] = useState(1);
  const [deleteTarget, setDeleteTarget] = useState<AdminProduct | null>(null);

  const { data: brands } = useAdminBrands();
  const { data: categories } = useAdminCategories();
  const { data, isLoading, isError, error, refetch } = useAdminProducts(q, brandId, categoryId, page);
  const deleteProduct = useDeleteProduct();
  const toast = useToast();

  async function confirmDelete(): Promise<void> {
    if (deleteTarget === null) return;
    await deleteProduct.mutateAsync(deleteTarget.id);
    toast.show(t('admin.products.deleted'));
    setDeleteTarget(null);
  }

  return (
    <AdminPage
      title={t('admin.products.title')}
      actions={
        <Link
          to="/admin/products/new"
          className="min-h-[36px] px-space-md rounded-full bg-primary text-on-primary text-label-md font-label-md flex items-center"
        >
          {t('admin.products.add')}
        </Link>
      }
    >
      <input
        value={q}
        onChange={(e) => {
          setQ(e.target.value);
          setPage(1);
        }}
        placeholder={t('home.searchPlaceholder')}
        className="min-h-[44px] px-space-md rounded-xl bg-surface-container text-on-surface text-body-md font-body-md"
      />

      <div className="flex gap-space-xs overflow-x-auto pb-space-xs">
        <button
          type="button"
          onClick={() => {
            setBrandId(undefined);
            setPage(1);
          }}
          className={`min-h-[36px] px-space-md rounded-full text-label-md font-label-md whitespace-nowrap ${
            brandId === undefined ? 'bg-primary text-on-primary' : 'bg-surface-container text-on-surface'
          }`}
        >
          {t('home.filterAll')}
        </button>
        {(brands ?? []).map((b) => (
          <button
            key={b.id}
            type="button"
            onClick={() => {
              setBrandId(b.id);
              setPage(1);
            }}
            className={`min-h-[36px] px-space-md rounded-full text-label-md font-label-md whitespace-nowrap ${
              brandId === b.id ? 'bg-primary text-on-primary' : 'bg-surface-container text-on-surface'
            }`}
          >
            {b.name}
          </button>
        ))}
      </div>

      <div className="flex gap-space-xs overflow-x-auto pb-space-xs">
        <button
          type="button"
          onClick={() => {
            setCategoryId(undefined);
            setPage(1);
          }}
          className={`min-h-[36px] px-space-md rounded-full text-label-md font-label-md whitespace-nowrap ${
            categoryId === undefined ? 'bg-primary text-on-primary' : 'bg-surface-container text-on-surface'
          }`}
        >
          {t('home.filterAll')}
        </button>
        {(categories ?? []).map((c) => (
          <button
            key={c.id}
            type="button"
            onClick={() => {
              setCategoryId(c.id);
              setPage(1);
            }}
            className={`min-h-[36px] px-space-md rounded-full text-label-md font-label-md whitespace-nowrap ${
              categoryId === c.id ? 'bg-primary text-on-primary' : 'bg-surface-container text-on-surface'
            }`}
          >
            {c.name}
          </button>
        ))}
      </div>

      {isLoading ? (
        Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-16" />)
      ) : isError ? (
        <AdminErrorState error={error} onRetry={() => void refetch()} />
      ) : (data?.items.length ?? 0) === 0 ? (
        <p className="text-body-md font-body-md text-on-surface-variant text-center py-space-2xl">{t('products.empty')}</p>
      ) : (
        <>
          <div className="flex flex-col gap-space-sm">
            {data!.items.map((product) => (
              <div key={product.id} className="bg-surface-container-lowest rounded-2xl p-space-md shadow-sm flex items-center justify-between gap-space-sm">
                <Link to={`/admin/products/${product.id}`} className="flex-1 min-w-0">
                  <p className="text-title-sm font-title-sm text-on-surface truncate">
                    {product.name} {product.is_active ? '' : `(${t('admin.products.inactive')})`}
                  </p>
                  <p className="text-body-sm font-body-sm text-on-surface-variant">
                    {t('admin.products.warrantyMonths')}: {product.warranty_months}
                  </p>
                </Link>
                <Link
                  to={`/admin/products/${product.id}/variants`}
                  className="min-h-[36px] px-space-sm flex items-center text-primary text-label-md font-label-md"
                >
                  {t('admin.variants.title')}
                </Link>
                <button
                  type="button"
                  onClick={() => setDeleteTarget(product)}
                  className="min-h-[36px] min-w-[36px] flex items-center justify-center rounded-xl bg-surface-container text-error"
                  aria-label={t('admin.products.delete')}
                >
                  <span className="material-symbols-outlined text-[20px]">delete</span>
                </button>
              </div>
            ))}
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

      {deleteTarget !== null && (
        <ConfirmDialog
          message={t('admin.products.deleteConfirm', { name: deleteTarget.name })}
          danger
          pending={deleteProduct.isPending}
          onCancel={() => setDeleteTarget(null)}
          onConfirm={() => void confirmDelete()}
        />
      )}
    </AdminPage>
  );
}

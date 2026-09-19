import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { AdminPage } from '../components/AdminPage.tsx';
import {
  useAdminBrands,
  useAdminCategories,
  useAdminProduct,
  useAdminVariants,
  useCreateProduct,
  useUpdateProduct,
} from '../queries.ts';
import { t } from '../../lib/i18n.ts';
import { useToast } from '../../lib/toast.tsx';
import type { ProductFormInput } from '../types.ts';

interface FieldErrors {
  name?: string;
  brandId?: string;
  categoryId?: string;
  warrantyMonths?: string;
}

interface SpecRow {
  key: string;
  value: string;
}

function validate(input: { name: string; brandId: number | null; categoryId: number | null; warrantyMonths: string }): FieldErrors {
  const errors: FieldErrors = {};
  if (input.name.trim().length === 0) errors.name = t('admin.products.errorName');
  if (input.brandId === null) errors.brandId = t('admin.products.errorBrand');
  if (input.categoryId === null) errors.categoryId = t('admin.products.errorCategory');
  const warranty = Number(input.warrantyMonths);
  if (!Number.isInteger(warranty) || warranty < 0) errors.warrantyMonths = t('admin.products.errorWarranty');
  return errors;
}

function specsToRows(specs: Record<string, unknown> | null | undefined): SpecRow[] {
  if (specs === null || specs === undefined) return [];
  return Object.entries(specs).map(([key, value]) => ({ key, value: String(value) }));
}

function rowsToSpecs(rows: SpecRow[]): Record<string, string> {
  const specs: Record<string, string> = {};
  for (const row of rows) {
    const key = row.key.trim();
    if (key.length === 0) continue;
    specs[key] = row.value;
  }
  return specs;
}

export function ProductForm(): JSX.Element {
  const { id } = useParams<{ id: string }>();
  const isEdit = id !== undefined && id !== 'new';
  const productId = isEdit ? Number(id) : null;
  const navigate = useNavigate();
  const toast = useToast();

  const { data: brands } = useAdminBrands();
  const { data: categories } = useAdminCategories();
  const { data: existing } = useAdminProduct(productId);
  const { data: variants } = useAdminVariants(productId);

  // Hooks must run unconditionally: always call these (with a harmless
  // placeholder id when creating), and simply never invoke their mutations
  // on the create path.
  const createProduct = useCreateProduct();
  const updateProduct = useUpdateProduct(productId ?? -1);

  const [name, setName] = useState('');
  const [brandId, setBrandId] = useState<number | null>(null);
  const [categoryId, setCategoryId] = useState<number | null>(null);
  const [description, setDescription] = useState('');
  const [warrantyMonths, setWarrantyMonths] = useState('12');
  const [specRows, setSpecRows] = useState<SpecRow[]>([]);
  const [isActive, setIsActive] = useState(true);
  const [errors, setErrors] = useState<FieldErrors>({});

  useEffect(() => {
    if (existing === undefined) return;
    setName(existing.name);
    setBrandId(existing.brand_id);
    setCategoryId(existing.category_id);
    setDescription(existing.description ?? '');
    setWarrantyMonths(String(existing.warranty_months));
    setSpecRows(specsToRows(existing.specs));
    setIsActive(existing.is_active);
  }, [existing]);

  async function handleSubmit(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    const fieldErrors = validate({ name, brandId, categoryId, warrantyMonths });
    setErrors(fieldErrors);
    if (Object.keys(fieldErrors).length > 0) return;

    const input: ProductFormInput = {
      name: name.trim(),
      brandId: brandId as number,
      categoryId: categoryId as number,
      warrantyMonths: Number(warrantyMonths),
      description: description.trim().length > 0 ? description.trim() : null,
      specs: rowsToSpecs(specRows),
      isActive,
    };

    if (isEdit) {
      await updateProduct.mutateAsync(input);
      toast.show(t('admin.products.saved'));
    } else {
      const created = await createProduct.mutateAsync(input);
      toast.show(t('admin.products.saved'));
      navigate(`/admin/products/${created.id}`, { replace: true });
    }
  }

  const pending = createProduct.isPending || updateProduct.isPending;
  const activeVariantCount = (variants ?? []).filter((v) => v.is_active).length;
  const showNoActiveVariantWarning = isEdit && variants !== undefined && activeVariantCount === 0;

  return (
    <AdminPage title={isEdit ? t('admin.products.editTitle') : t('admin.products.newTitle')}>
      {showNoActiveVariantWarning && (
        <div className="bg-error-container/40 rounded-xl p-space-md flex flex-col gap-space-xs">
          <p className="text-body-sm font-body-sm text-on-surface">{t('admin.products.noActiveVariantWarning')}</p>
        </div>
      )}

      <form onSubmit={(e) => void handleSubmit(e)} className="flex flex-col gap-space-md">
        <label className="flex flex-col gap-space-xs">
          <span className="text-label-md font-label-md text-on-surface-variant">{t('admin.products.name')}</span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="min-h-[44px] px-space-md rounded-xl bg-surface-container text-on-surface text-body-md font-body-md"
          />
          {errors.name !== undefined && <span className="text-body-sm font-body-sm text-error">{errors.name}</span>}
        </label>

        <label className="flex flex-col gap-space-xs">
          <span className="text-label-md font-label-md text-on-surface-variant">{t('admin.products.brand')}</span>
          <select
            value={brandId ?? ''}
            onChange={(e) => setBrandId(e.target.value.length > 0 ? Number(e.target.value) : null)}
            className="min-h-[44px] px-space-md rounded-xl bg-surface-container text-on-surface text-body-md font-body-md"
          >
            <option value="">-</option>
            {(brands ?? []).map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
          {errors.brandId !== undefined && <span className="text-body-sm font-body-sm text-error">{errors.brandId}</span>}
        </label>

        <label className="flex flex-col gap-space-xs">
          <span className="text-label-md font-label-md text-on-surface-variant">{t('admin.products.category')}</span>
          <select
            value={categoryId ?? ''}
            onChange={(e) => setCategoryId(e.target.value.length > 0 ? Number(e.target.value) : null)}
            className="min-h-[44px] px-space-md rounded-xl bg-surface-container text-on-surface text-body-md font-body-md"
          >
            <option value="">-</option>
            {(categories ?? []).map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          {errors.categoryId !== undefined && <span className="text-body-sm font-body-sm text-error">{errors.categoryId}</span>}
        </label>

        <label className="flex flex-col gap-space-xs">
          <span className="text-label-md font-label-md text-on-surface-variant">{t('admin.products.warrantyMonths')}</span>
          <input
            inputMode="numeric"
            value={warrantyMonths}
            onChange={(e) => setWarrantyMonths(e.target.value.replace(/\D/g, ''))}
            className="min-h-[44px] px-space-md rounded-xl bg-surface-container text-on-surface text-body-md font-body-md"
          />
          {errors.warrantyMonths !== undefined && <span className="text-body-sm font-body-sm text-error">{errors.warrantyMonths}</span>}
        </label>

        <label className="flex flex-col gap-space-xs">
          <span className="text-label-md font-label-md text-on-surface-variant">{t('admin.products.description')}</span>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={4}
            className="px-space-md py-space-sm rounded-xl bg-surface-container text-on-surface text-body-md font-body-md"
          />
        </label>

        <div className="flex flex-col gap-space-xs">
          <span className="text-label-md font-label-md text-on-surface-variant">{t('admin.products.specs')}</span>
          {specRows.map((row, i) => (
            <div key={i} className="flex gap-space-xs">
              <input
                value={row.key}
                onChange={(e) => setSpecRows((rows) => rows.map((r, ri) => (ri === i ? { ...r, key: e.target.value } : r)))}
                placeholder={t('admin.products.specKey')}
                className="flex-1 min-h-[40px] px-space-sm rounded-xl bg-surface-container text-on-surface text-body-sm font-body-sm"
              />
              <input
                value={row.value}
                onChange={(e) => setSpecRows((rows) => rows.map((r, ri) => (ri === i ? { ...r, value: e.target.value } : r)))}
                placeholder={t('admin.products.specValue')}
                className="flex-1 min-h-[40px] px-space-sm rounded-xl bg-surface-container text-on-surface text-body-sm font-body-sm"
              />
              <button
                type="button"
                onClick={() => setSpecRows((rows) => rows.filter((_, ri) => ri !== i))}
                aria-label={t('admin.products.specRemove')}
                className="min-w-[40px] min-h-[40px] flex items-center justify-center rounded-xl bg-surface-container text-error"
              >
                <span className="material-symbols-outlined text-[18px]">close</span>
              </button>
            </div>
          ))}
          <button
            type="button"
            onClick={() => setSpecRows((rows) => [...rows, { key: '', value: '' }])}
            className="self-start min-h-[36px] px-space-md rounded-full bg-surface-container text-on-surface text-label-md font-label-md"
          >
            {t('admin.products.specAdd')}
          </button>
        </div>

        <label className="flex items-center gap-space-sm">
          <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} className="w-5 h-5" />
          <span className="text-body-md font-body-md text-on-surface">{t('admin.products.active')}</span>
        </label>

        <button
          type="submit"
          disabled={pending}
          className="min-h-[48px] rounded-xl bg-primary text-on-primary text-label-md font-label-md disabled:opacity-50"
        >
          {t('profile.save')}
        </button>
      </form>

      {isEdit && productId !== null && (
        <Link
          to={`/admin/products/${productId}/variants`}
          className="min-h-[48px] rounded-xl bg-surface-container-lowest shadow-sm text-on-surface text-label-md font-label-md flex items-center justify-center gap-space-xs"
        >
          <span className="material-symbols-outlined text-[18px]">tune</span>
          {t('admin.products.manageVariants')}
        </Link>
      )}
    </AdminPage>
  );
}

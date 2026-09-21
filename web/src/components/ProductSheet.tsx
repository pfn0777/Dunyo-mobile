import { useEffect, useMemo, useState } from 'react';
import { mediaUrl } from '../lib/config.ts';
import { cartStore } from '../lib/cart.ts';
import { useCartLines } from '../lib/useCart.ts';
import { useProductDetail } from '../lib/queries.ts';
import { PriceTag } from './PriceTag.tsx';
import { ImagePlaceholder } from './Placeholder.tsx';

/** Fallback when a category has no icon set; every seeded category does. */
const DEFAULT_CATEGORY_ICON = 'smartphone';
import { InstallmentLine } from './InstallmentLine.tsx';
import { Skeleton } from './States.tsx';
import { t } from '../lib/i18n.ts';
import type { Product, ProductVariant } from '../lib/types.ts';

interface ColorOption {
  name: string;
  hex: string | null;
}

function uniqueColors(variants: ProductVariant[]): ColorOption[] {
  const seen = new Map<string, ColorOption>();
  for (const v of variants) {
    if (!seen.has(v.color_name)) seen.set(v.color_name, { name: v.color_name, hex: v.color_hex });
  }
  return [...seen.values()];
}

function storagesForColor(variants: ProductVariant[], colorName: string): number[] {
  const values = new Set<number>();
  for (const v of variants) {
    if (v.color_name === colorName && v.storage_gb !== null) values.add(v.storage_gb);
  }
  return [...values].sort((a, b) => a - b);
}

/** Picks the initial (color, storage) selection: prefer a variant that has
 * stock, falling back to the first variant so a fully sold-out product still
 * shows something (with "Savatga" disabled). */
function pickInitialVariant(variants: ProductVariant[]): ProductVariant | null {
  if (variants.length === 0) return null;
  return variants.find((v) => v.stock > 0) ?? variants[0] ?? null;
}

export function ProductSheet({ product, onClose }: { product: Product; onClose: () => void }): JSX.Element {
  const { data: detail, isLoading } = useProductDetail(product.id);
  const lines = useCartLines();
  const [selectedColor, setSelectedColor] = useState<string | null>(null);
  const [selectedStorage, setSelectedStorage] = useState<number | null>(null);
  const [qty, setQty] = useState(1);

  const variants = detail?.variants ?? [];
  const colors = useMemo(() => uniqueColors(variants), [variants]);
  const hasStorageDimension = variants.some((v) => v.storage_gb !== null);

  useEffect(() => {
    if (variants.length === 0) return;
    const initial = pickInitialVariant(variants);
    if (initial === null) return;
    setSelectedColor((prev) => prev ?? initial.color_name);
    setSelectedStorage((prev) => (prev !== null ? prev : initial.storage_gb));
    // Only seed once per loaded detail (variants array identity changes on refetch).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [variants.length]);

  const storageOptions = selectedColor !== null ? storagesForColor(variants, selectedColor) : [];

  const selectedVariant =
    variants.find(
      (v) => v.color_name === selectedColor && (hasStorageDimension ? v.storage_gb === selectedStorage : true),
    ) ?? null;

  useEffect(() => {
    setQty(1);
  }, [selectedVariant?.id]);

  const line = selectedVariant !== null ? lines.find((l) => l.variantId === selectedVariant.id) : undefined;
  const mainUrl = selectedVariant !== null ? mediaUrl(selectedVariant.image_path ?? selectedVariant.image_thumb_path) : null;
  const canAdd = selectedVariant !== null && selectedVariant.stock > 0;

  const handleAdd = (): void => {
    if (selectedVariant === null || detail === undefined) return;
    cartStore.addOrIncrement(
      {
        variantId: selectedVariant.id,
        productId: detail.id,
        price: selectedVariant.price,
        oldPrice: selectedVariant.old_price,
        name: detail.name,
        colorName: selectedVariant.color_name,
        storageGb: selectedVariant.storage_gb,
        thumb: mainUrl,
        stock: selectedVariant.stock,
      },
      qty,
    );
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end" role="dialog" aria-modal="true">
      <button type="button" aria-label={t('common.close')} className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative w-full bg-surface-container-low rounded-t-2xl p-margin pb-safe max-h-[88vh] overflow-y-auto">
        <button
          type="button"
          aria-label={t('common.close')}
          onClick={onClose}
          className="absolute top-space-md right-space-md w-9 h-9 flex items-center justify-center rounded-full bg-surface-container-high z-10"
        >
          <span className="material-symbols-outlined text-[18px]">close</span>
        </button>

        {mainUrl !== null ? (
          <img
            src={mainUrl}
            alt={product.name}
            className="w-full max-h-[38vh] object-contain rounded-2xl mb-space-md"
          />
        ) : (
          <ImagePlaceholder icon={product.category_icon ?? DEFAULT_CATEGORY_ICON} className="w-full max-h-[38vh] aspect-square rounded-2xl mb-space-md" />
        )}

        <p className="text-label-sm font-label-sm text-primary-text uppercase tracking-wide">{product.brand_name}</p>
        <p className="text-headline-md font-headline-md text-on-surface mb-space-sm">{product.name}</p>

        {isLoading || selectedVariant === null ? (
          <Skeleton className="h-24" />
        ) : (
          <>
            <PriceTag price={selectedVariant.price} oldPrice={selectedVariant.old_price} />
            <InstallmentLine price={selectedVariant.price} className="mt-1" />

            {colors.length > 1 && (
              <div className="mt-space-md">
                <p className="text-label-lg font-label-lg text-on-surface-variant mb-space-sm">{t('variant.color')}</p>
                <div className="flex items-center gap-space-sm flex-wrap">
                  {colors.map((c) => (
                    <button
                      key={c.name}
                      type="button"
                      aria-label={c.name}
                      aria-pressed={selectedColor === c.name}
                      onClick={() => setSelectedColor(c.name)}
                      className={`w-9 h-9 rounded-full border-2 flex items-center justify-center ${
                        selectedColor === c.name ? 'border-primary' : 'border-transparent'
                      }`}
                    >
                      <span
                        className="w-6 h-6 rounded-full border border-outline-variant"
                        style={{ backgroundColor: c.hex ?? '#888888' }}
                      />
                    </button>
                  ))}
                </div>
              </div>
            )}

            {hasStorageDimension && storageOptions.length > 0 && (
              <div className="mt-space-md">
                <p className="text-label-lg font-label-lg text-on-surface-variant mb-space-sm">{t('variant.storage')}</p>
                <div className="flex items-center gap-space-sm flex-wrap">
                  {storageOptions.map((gb) => {
                    const variantForChip = variants.find((v) => v.color_name === selectedColor && v.storage_gb === gb);
                    const chipOutOfStock = variantForChip === undefined || variantForChip.stock <= 0;
                    return (
                      <button
                        key={gb}
                        type="button"
                        disabled={chipOutOfStock}
                        onClick={() => setSelectedStorage(gb)}
                        className={`px-space-md h-10 rounded-full text-label-lg font-label-lg border ${
                          selectedStorage === gb ? 'bg-primary text-on-primary border-primary' : 'border-outline-variant text-on-surface'
                        } ${chipOutOfStock ? 'opacity-40 line-through' : ''}`}
                      >
                        {gb} GB
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="mt-space-lg flex items-center gap-space-md">
              {canAdd && (
                <div className="flex items-center h-12 rounded-full bg-surface-container-high">
                  <button
                    type="button"
                    aria-label="Kamaytirish"
                    className="w-11 h-11 flex items-center justify-center text-lg"
                    onClick={() => setQty((q) => Math.max(1, q - 1))}
                  >
                    -
                  </button>
                  <span className="w-8 text-center text-label-lg font-label-lg">{qty}</span>
                  <button
                    type="button"
                    aria-label="Ko'paytirish"
                    className="w-11 h-11 flex items-center justify-center text-lg disabled:opacity-40"
                    disabled={qty >= selectedVariant.stock}
                    onClick={() => setQty((q) => Math.min(selectedVariant.stock, q + 1))}
                  >
                    +
                  </button>
                </div>
              )}
              <button
                type="button"
                disabled={!canAdd}
                onClick={handleAdd}
                className="flex-1 h-12 rounded-full bg-primary text-on-primary text-label-lg font-label-lg disabled:opacity-40"
              >
                {!canAdd ? t('products.outOfStock') : line !== undefined ? t('variant.updateCart') : t('products.addToCart')}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

import { useState } from 'react';
import { mediaUrl } from '../lib/config.ts';
import { useFavorites, useToggleFavorite } from '../lib/queries.ts';
import { PriceTag, discountPercent } from './PriceTag.tsx';
import { ImagePlaceholder } from './Placeholder.tsx';

/** Fallback when a category has no icon set; every seeded category does. */
const DEFAULT_CATEGORY_ICON = 'smartphone';
import { InstallmentLine } from './InstallmentLine.tsx';
import { useToast } from '../lib/toast.tsx';
import { t } from '../lib/i18n.ts';
import type { Product } from '../lib/types.ts';

/** Shared grid for product cards: every card in a row stretches to the row height. */
export const PRODUCT_GRID_CLASS = 'grid grid-cols-2 gap-space-sm items-stretch';

/**
 * Unlike XUMO, a card can no longer add to cart directly: a product has
 * variants (colour/storage) with different price and stock, so "Savatga"
 * here always opens the ProductSheet for the user to pick one first. This
 * is a deliberate v1 change, not an omission.
 */
export function ProductCard({ product, onOpen }: { product: Product; onOpen: (product: Product) => void }): JSX.Element {
  const { data: favorites } = useFavorites();
  const toggleFavorite = useToggleFavorite();
  const toast = useToast();
  const [pendingFavorite, setPendingFavorite] = useState<boolean | null>(null);

  const isFavorite = pendingFavorite ?? favorites?.some((f) => f.id === product.id) ?? false;
  const thumbUrl = mediaUrl(product.thumb);
  const percentOff = discountPercent(product.min_price, product.old_price);
  const outOfStock = product.total_stock <= 0;

  const handleToggleFavorite = (event: React.MouseEvent): void => {
    event.stopPropagation();
    const next = !isFavorite;
    setPendingFavorite(next);
    toggleFavorite.mutate(
      { productId: product.id, isFavorite },
      {
        onError: () => {
          setPendingFavorite(null);
          toast.show(t('common.error'));
        },
        onSuccess: () => setPendingFavorite(null),
      },
    );
  };

  // A native <button> cannot contain other interactive controls (the
  // favourite heart, the "Savatga" button), so the tappable card root is a
  // div with the button role + keyboard handling instead of a real <button>.
  const handleCardKeyDown = (event: React.KeyboardEvent): void => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      onOpen(product);
    }
  };

  return (
    <div
      role="button"
      tabIndex={0}
      aria-label={product.name}
      className="flex flex-col h-full text-left bg-surface-container rounded-xl overflow-hidden shadow-sm cursor-pointer p-space-xs"
      onClick={() => onOpen(product)}
      onKeyDown={handleCardKeyDown}
    >
      <div className="relative aspect-square rounded-lg overflow-hidden bg-surface-container-high">
        {thumbUrl !== null ? (
          <img src={thumbUrl} alt={product.name} className="w-full h-full object-cover" loading="lazy" />
        ) : (
          <ImagePlaceholder icon={product.category_icon ?? DEFAULT_CATEGORY_ICON} className="w-full h-full" />
        )}
        {percentOff !== null && (
          <span className="absolute top-2 left-2 bg-error text-on-error text-label-sm font-label-sm px-2 py-0.5 rounded-full">
            -{percentOff}%
          </span>
        )}
        <button
          type="button"
          aria-label={isFavorite ? "Sevimlilardan olib tashlash" : "Sevimlilarga qo'shish"}
          onClick={handleToggleFavorite}
          className="absolute top-2 right-2 w-8 h-8 flex items-center justify-center rounded-full bg-surface/85 dark:bg-black/40"
        >
          <span className={`material-symbols-outlined text-[18px] ${isFavorite ? 'text-error' : 'text-on-surface dark:text-white'}`}>
            {isFavorite ? 'favorite' : 'favorite_border'}
          </span>
        </button>
      </div>
      <div className="flex flex-col flex-1 gap-1 pt-space-sm px-1 pb-1">
        <p className="text-label-sm font-label-sm text-primary-text uppercase tracking-wide truncate">{product.brand_name}</p>
        <p className="text-body-md font-body-md text-on-surface line-clamp-2">{product.name}</p>
        <PriceTag price={product.min_price} oldPrice={product.old_price} />
        <InstallmentLine price={product.min_price} />
        {outOfStock ? (
          <span className="mt-auto h-11 flex items-center justify-center rounded-full bg-surface-container-high text-on-surface-variant text-label-lg font-label-lg">
            {t('products.outOfStock')}
          </span>
        ) : (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onOpen(product);
            }}
            className="mt-auto h-11 rounded-full bg-primary text-on-primary text-label-lg font-label-lg flex items-center justify-center gap-1"
          >
            <span className="material-symbols-outlined text-[18px]">shopping_bag</span>
            {t('products.addToCart')}
          </button>
        )}
      </div>
    </div>
  );
}

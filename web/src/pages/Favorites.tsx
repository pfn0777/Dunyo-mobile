import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCategories, useFavorites } from '../lib/queries.ts';
import { ProductCard } from '../components/ProductCard.tsx';
import { ProductSheet } from '../components/ProductSheet.tsx';
import { ErrorState, Skeleton } from '../components/States.tsx';
import { t } from '../lib/i18n.ts';
import type { Product } from '../lib/types.ts';

// Per favorites.png, minus the "narx tushishi xabari" (price-drop
// notification) toggle — v2, see spec's exclusion list. Bulk "add all to
// cart" is also left out here: unlike XUMO, a favorite is a product (not a
// SKU), so adding it to the cart needs a colour/storage choice first — the
// ProductSheet already covers that per product.
export function Favorites(): JSX.Element {
  const navigate = useNavigate();
  const { data: favorites, isLoading, isError, refetch } = useFavorites();
  const { data: categories } = useCategories();
  const [activeCategory, setActiveCategory] = useState<number | null>(null);
  const [openProduct, setOpenProduct] = useState<Product | null>(null);

  const products = favorites ?? [];
  const categoryCounts = useMemo(() => {
    const counts = new Map<number, number>();
    for (const p of products) counts.set(p.category_id, (counts.get(p.category_id) ?? 0) + 1);
    return counts;
  }, [products]);
  const visible = activeCategory === null ? products : products.filter((p) => p.category_id === activeCategory);

  return (
    <div className="flex flex-col min-h-screen pb-24">
      <header className="sticky top-0 z-30 bg-surface/90 backdrop-blur-xl pt-safe px-margin h-14 flex items-center gap-space-xs shadow-sm">
        <h1 className="text-headline-md font-headline-md text-on-surface">{t('favorites.title')}</h1>
        {products.length > 0 && (
          <span className="px-2 py-0.5 rounded-full bg-secondary/15 text-secondary text-label-sm font-label-sm">
            {t('home.categoriesCount', { count: products.length })}
          </span>
        )}
      </header>

      <main className="px-margin pt-space-md">
        {isLoading ? (
          <div className="grid grid-cols-2 gap-space-sm">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-64" />
            ))}
          </div>
        ) : isError ? (
          <ErrorState onRetry={() => refetch()} />
        ) : products.length === 0 ? (
          <div className="flex flex-col items-center text-center gap-space-sm py-space-xl">
            <span className="material-symbols-outlined text-[40px] text-on-surface-variant">favorite_border</span>
            <p className="text-body-lg font-body-lg text-on-surface font-semibold">{t('favorites.empty.title')}</p>
            <p className="text-body-sm font-body-sm text-on-surface-variant">{t('favorites.empty.text')}</p>
            <button
              type="button"
              onClick={() => navigate('/catalog')}
              className="min-h-[44px] px-space-lg rounded-full bg-primary text-on-primary text-label-lg font-label-lg"
            >
              {t('favorites.empty.cta')}
            </button>
          </div>
        ) : (
          <>
            <div className="flex gap-space-xs overflow-x-auto no-scrollbar mb-space-md">
              <button
                type="button"
                onClick={() => setActiveCategory(null)}
                className={`flex-shrink-0 px-3.5 py-1.5 rounded-full text-label-sm font-label-sm ${
                  activeCategory === null ? 'bg-primary text-on-primary' : 'bg-surface-container text-on-surface-variant'
                }`}
              >
                {t('home.filterAll')} ({products.length})
              </button>
              {(categories ?? [])
                .filter((c) => categoryCounts.has(c.id))
                .map((category) => (
                  <button
                    key={category.id}
                    type="button"
                    onClick={() => setActiveCategory(category.id)}
                    className={`flex-shrink-0 px-3.5 py-1.5 rounded-full text-label-sm font-label-sm ${
                      activeCategory === category.id ? 'bg-primary text-on-primary' : 'bg-surface-container text-on-surface-variant'
                    }`}
                  >
                    {category.name} ({categoryCounts.get(category.id)})
                  </button>
                ))}
            </div>
            <div className="grid grid-cols-2 gap-space-sm">
              {visible.map((product) => (
                <ProductCard key={product.id} product={product} onOpen={setOpenProduct} />
              ))}
            </div>
          </>
        )}
      </main>

      {openProduct !== null && <ProductSheet product={openProduct} onClose={() => setOpenProduct(null)} />}
    </div>
  );
}

import { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useBrands, useCategories, useProductsInfinite } from '../lib/queries.ts';
import { useTelegramBackButton } from '../lib/useBackButton.ts';
import { ProductCard } from '../components/ProductCard.tsx';
import { ProductSheet } from '../components/ProductSheet.tsx';
import { FloatingCartPill } from '../components/FloatingCartPill.tsx';
import { Skeleton, ErrorState } from '../components/States.tsx';
import { t } from '../lib/i18n.ts';
import type { Product, SortOption } from '../lib/types.ts';

const SEARCH_DEBOUNCE_MS = 300;

const SORT_LABELS: Record<SortOption, string> = {
  popular: t('products.sortPopular'),
  cheap: t('products.sortCheap'),
  expensive: t('products.sortExpensive'),
  discount: t('products.sortDiscount'),
};

// Per spec, star ratings shown in design/stitch/catalog.png are omitted
// (v2 exclusion list item "Reyting va sharhlar").
export function Products(): JSX.Element {
  useTelegramBackButton('/catalog');
  const [params, setParams] = useSearchParams();
  const [searchInput, setSearchInput] = useState(params.get('q') ?? '');
  const [sortOpen, setSortOpen] = useState(false);
  const [openProduct, setOpenProduct] = useState<Product | null>(null);
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  const { data: categories } = useCategories();
  const { data: brands } = useBrands();

  const categoryId = params.get('category');
  const brandId = params.get('brand');
  const q = params.get('q') ?? '';
  const sort = (params.get('sort') as SortOption | null) ?? 'popular';
  const discount = params.get('discount') === '1';

  useEffect(() => {
    const handle = setTimeout(() => {
      if (searchInput !== q) {
        const next = new URLSearchParams(params);
        if (searchInput.length > 0) next.set('q', searchInput);
        else next.delete('q');
        setParams(next, { replace: true });
      }
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(handle);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchInput]);

  const query = useMemo(
    () => ({
      categoryId: categoryId !== null ? Number(categoryId) : undefined,
      brandId: brandId !== null ? Number(brandId) : undefined,
      q: q.length > 0 ? q : undefined,
      sort,
      discount: discount || undefined,
    }),
    [categoryId, brandId, q, sort, discount],
  );

  const result = useProductsInfinite(query);
  const products = useMemo(() => result.data?.pages.flatMap((p) => p.items) ?? [], [result.data]);
  const total = result.data?.pages[0]?.total ?? 0;

  useEffect(() => {
    const el = sentinelRef.current;
    if (el === null) return;
    const observer = new IntersectionObserver((entries) => {
      if (entries[0]?.isIntersecting && result.hasNextPage && !result.isFetchingNextPage) {
        void result.fetchNextPage();
      }
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [result]);

  const setSort = (next: SortOption): void => {
    const nextParams = new URLSearchParams(params);
    nextParams.set('sort', next);
    setParams(nextParams, { replace: true });
    setSortOpen(false);
  };

  const setCategoryFilter = (id: number | null): void => {
    const next = new URLSearchParams(params);
    if (id === null) next.delete('category');
    else next.set('category', String(id));
    setParams(next, { replace: true });
  };

  const setBrandFilter = (id: number | null): void => {
    const next = new URLSearchParams(params);
    if (id === null) next.delete('brand');
    else next.set('brand', String(id));
    setParams(next, { replace: true });
  };

  return (
    <div className="flex flex-col min-h-screen pb-40">
      <header className="sticky top-0 z-30 bg-surface/90 backdrop-blur-xl pt-safe px-margin pb-space-sm shadow-sm flex flex-col gap-space-sm">
        <div className="flex items-center gap-space-sm bg-surface-container-high rounded-full px-space-md h-11">
          <span className="material-symbols-outlined text-primary text-[20px]">search</span>
          <input
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder={t('home.searchPlaceholder')}
            aria-label={t('home.searchPlaceholder')}
            className="bg-transparent w-full text-body-md font-body-md text-on-surface placeholder:text-on-surface-variant focus:outline-none"
          />
        </div>

        {brands !== undefined && brands.length > 0 && (
          <div className="flex items-center gap-space-xs overflow-x-auto no-scrollbar">
            <button
              type="button"
              onClick={() => setBrandFilter(null)}
              className={`flex-shrink-0 px-3.5 py-1.5 rounded-full text-label-md font-label-md ${
                brandId === null ? 'bg-primary text-on-primary' : 'bg-surface-container text-on-surface-variant'
              }`}
            >
              {t('home.filterAll')}
            </button>
            {brands.map((brand) => (
              <button
                key={brand.id}
                type="button"
                onClick={() => setBrandFilter(brand.id)}
                className={`flex-shrink-0 px-3.5 py-1.5 rounded-full text-label-md font-label-md ${
                  brandId === String(brand.id) ? 'bg-primary text-on-primary' : 'bg-surface-container text-on-surface-variant'
                }`}
              >
                {brand.name}
              </button>
            ))}
          </div>
        )}

        {categories !== undefined && categories.length > 0 && (
          <div className="flex items-center gap-space-xs overflow-x-auto no-scrollbar">
            <button
              type="button"
              onClick={() => setCategoryFilter(null)}
              className={`flex-shrink-0 px-3.5 py-1.5 rounded-full text-label-sm font-label-sm ${
                categoryId === null ? 'text-primary underline' : 'text-on-surface-variant'
              }`}
            >
              {t('home.filterAll')}
            </button>
            {categories.map((category) => (
              <button
                key={category.id}
                type="button"
                onClick={() => setCategoryFilter(category.id)}
                className={`flex-shrink-0 px-3.5 py-1.5 rounded-full text-label-sm font-label-sm ${
                  categoryId === String(category.id) ? 'text-primary underline' : 'text-on-surface-variant'
                }`}
              >
                {category.name}
              </button>
            ))}
          </div>
        )}

        <div className="flex items-center justify-between">
          <span className="text-body-sm font-body-sm text-on-surface-variant">{t('products.foundCount', { count: total })}</span>
          <button
            type="button"
            onClick={() => setSortOpen(true)}
            className="flex items-center gap-1 text-label-lg font-label-lg text-primary min-h-[44px]"
          >
            <span className="material-symbols-outlined text-[18px]">sort</span>
            {SORT_LABELS[sort]}
          </button>
        </div>
      </header>

      <main className="px-margin pt-space-md">
        {result.isLoading ? (
          <div className="grid grid-cols-2 gap-space-sm">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-64" />
            ))}
          </div>
        ) : result.isError ? (
          <ErrorState onRetry={() => result.refetch()} />
        ) : products.length === 0 ? (
          <p className="text-body-md font-body-md text-on-surface-variant text-center py-space-xl">{t('products.empty')}</p>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-space-sm">
              {products.map((product) => (
                <ProductCard key={product.id} product={product} onOpen={setOpenProduct} />
              ))}
            </div>
            <div ref={sentinelRef} className="h-8" />
          </>
        )}
      </main>

      {sortOpen && (
        <div className="fixed inset-0 z-50 flex items-end" role="dialog" aria-modal="true">
          <button type="button" aria-label={t('common.close')} className="absolute inset-0 bg-black/50" onClick={() => setSortOpen(false)} />
          <div className="relative w-full bg-surface-container-low rounded-t-2xl p-margin pb-safe">
            <h3 className="text-headline-md font-headline-md text-on-surface mb-space-md">{t('products.sort')}</h3>
            <div className="flex flex-col gap-1">
              {(Object.keys(SORT_LABELS) as SortOption[]).map((option) => (
                <button
                  key={option}
                  type="button"
                  onClick={() => setSort(option)}
                  className={`text-left min-h-[44px] px-space-sm rounded-xl text-body-lg font-body-lg ${
                    sort === option ? 'text-primary font-semibold' : 'text-on-surface'
                  }`}
                >
                  {SORT_LABELS[option]}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {openProduct !== null && <ProductSheet product={openProduct} onClose={() => setOpenProduct(null)} />}
      <FloatingCartPill />
    </div>
  );
}

import { useNavigate } from 'react-router-dom';
import { useBrands, useCategories } from '../lib/queries.ts';
import { mediaUrl } from '../lib/config.ts';
import { FloatingCartPill } from '../components/FloatingCartPill.tsx';
import { Skeleton, ErrorState } from '../components/States.tsx';
import { t } from '../lib/i18n.ts';

export function Catalog(): JSX.Element {
  const navigate = useNavigate();
  const { data: categories, isLoading, isError, refetch } = useCategories();
  const { data: brands } = useBrands();

  return (
    <div className="flex flex-col min-h-screen pb-40">
      <header className="sticky top-0 z-30 bg-surface/90 backdrop-blur-xl pt-safe px-margin h-14 flex items-center shadow-sm">
        <h1 className="text-headline-md font-headline-md text-on-surface">{t('catalog.title')}</h1>
      </header>

      <main className="px-margin pt-space-md flex flex-col gap-space-lg">
        {brands !== undefined && brands.length > 0 && (
          <section className="flex items-center gap-space-sm overflow-x-auto no-scrollbar pb-1">
            {brands.map((brand) => (
              <button
                key={brand.id}
                type="button"
                onClick={() => navigate(`/products?brand=${brand.id}`)}
                className="flex-shrink-0 px-space-md h-9 rounded-full bg-surface-container text-on-surface-variant text-label-lg font-label-lg"
              >
                {brand.name}
              </button>
            ))}
          </section>
        )}

        {isLoading ? (
          <div className="grid grid-cols-3 gap-2.5">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-28" />
            ))}
          </div>
        ) : isError ? (
          <ErrorState onRetry={() => refetch()} />
        ) : (
          <div className="grid grid-cols-3 gap-2.5">
            <button
              type="button"
              onClick={() => navigate('/products?discount=1')}
              className="relative flex flex-col justify-between bg-surface-container rounded-xl p-2.5 shadow-sm text-left overflow-hidden"
            >
              <span className="absolute top-2 right-2 w-5 h-5 rounded-full bg-error text-on-error flex items-center justify-center">
                <span className="material-symbols-outlined text-[12px]">percent</span>
              </span>
              <span className="text-body-lg font-body-lg text-on-surface leading-tight pr-6">{t('catalog.discountEntry')}</span>
              <span className="mt-2 w-full aspect-square flex items-center justify-center">
                <span className="material-symbols-outlined text-primary text-[28px]">sell</span>
              </span>
            </button>
            {(categories ?? []).map((category) => (
              <button
                key={category.id}
                type="button"
                onClick={() => navigate(`/products?category=${category.id}`)}
                className="flex flex-col justify-between bg-surface-container rounded-xl p-2.5 shadow-sm text-left"
              >
                <span className="text-body-lg font-body-lg text-on-surface leading-tight line-clamp-3">{category.name}</span>
                <span className="mt-2 w-full aspect-square flex items-center justify-center">
                  {category.image_path !== null ? (
                    <img src={mediaUrl(category.image_path) ?? undefined} alt="" loading="lazy" className="w-full h-full object-contain rounded-xl" />
                  ) : (
                    <span className="material-symbols-outlined text-primary text-[28px]">{category.icon ?? 'smartphone'}</span>
                  )}
                </span>
              </button>
            ))}
          </div>
        )}
      </main>
      <FloatingCartPill />
    </div>
  );
}

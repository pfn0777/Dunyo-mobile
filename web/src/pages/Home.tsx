import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCategories, useProductsInfinite, useRegions } from '../lib/queries.ts';
import { ProductCard } from '../components/ProductCard.tsx';
import { ProductSheet } from '../components/ProductSheet.tsx';
import { RegionPicker } from '../components/RegionPicker.tsx';
import { Logo } from '../components/Logo.tsx';
import { ThemeToggle } from '../components/ThemeToggle.tsx';
import { Skeleton, ErrorState } from '../components/States.tsx';
import { config, mediaUrl } from '../lib/config.ts';
import { openTelegramLink } from '../lib/telegram.ts';
import { useSelectedRegionId } from '../lib/region.ts';
import { t } from '../lib/i18n.ts';
import type { Product } from '../lib/types.ts';

const VISIBLE_CATEGORY_COUNT = 8;

// Design (design/stitch/home.png) deliberately omitted per spec's v2
// exclusion list: the "Svayplar & Obzorlar" reels/stories row, the mic and
// QR-scanner icons inside the search bar, and the language switcher in the
// header.
export function Home(): JSX.Element {
  const navigate = useNavigate();
  const { data: categories, isLoading: categoriesLoading } = useCategories();
  const { data: regions } = useRegions();
  const selectedRegionId = useSelectedRegionId();
  const [regionPickerOpen, setRegionPickerOpen] = useState(false);
  const [openProduct, setOpenProduct] = useState<Product | null>(null);

  const trendingQuery = useProductsInfinite({ sort: 'popular' });
  const trending = useMemo(() => trendingQuery.data?.pages.flatMap((p) => p.items).slice(0, 8) ?? [], [trendingQuery.data]);

  const visibleCategories = (categories ?? []).slice(0, VISIBLE_CATEGORY_COUNT);
  const selectedRegionName = regions?.find((r) => r.id === selectedRegionId)?.name ?? t('regions.choose');

  const handleOpenChannel = (): void => {
    if (config.channelUsername.length > 0) openTelegramLink(`https://t.me/${config.channelUsername}`);
  };

  return (
    <div className="flex flex-col min-h-screen pb-28">
      <header className="sticky top-0 z-30 bg-surface/90 backdrop-blur-xl pt-safe px-margin pb-space-sm shadow-sm">
        <div className="flex items-center justify-between gap-space-sm h-14">
          <div className="flex items-center gap-space-sm min-w-0">
            <Logo />
            <span className="flex items-center gap-1 min-w-0">
              <span className="text-headline-md font-headline-md text-primary-text tracking-tight truncate">Dunyo Mobile</span>
              <span className="material-symbols-outlined text-secondary text-[16px]" title="Rasmiy do'kon">
                verified
              </span>
            </span>
          </div>
          <ThemeToggle />
        </div>
        <button
          type="button"
          onClick={() => setRegionPickerOpen(true)}
          className="flex items-center gap-1 py-1 text-left"
        >
          <span className="material-symbols-outlined text-[15px] text-secondary">location_on</span>
          <span className="text-body-sm font-body-sm text-on-surface-variant">{t('home.deliveryAddress')}:</span>
          <span className="text-label-lg font-label-lg text-on-surface">{selectedRegionName}</span>
          <span className="material-symbols-outlined text-[14px] text-on-surface-variant">keyboard_arrow_down</span>
        </button>
        <button
          type="button"
          onClick={() => navigate('/catalog')}
          className="flex items-center gap-space-sm bg-surface-container-high rounded-full px-space-md h-11 w-full text-left mt-space-sm shadow-md"
        >
          <span className="material-symbols-outlined text-primary-text text-[20px]">search</span>
          <span className="text-body-md font-body-md text-on-surface-variant">{t('home.searchPlaceholder')}</span>
        </button>
      </header>

      <main className="flex flex-col gap-space-xl pt-space-md px-margin">
        <section className="w-full">
          <div className="relative w-full rounded-xl overflow-hidden bg-gradient-to-br from-surface-container-highest via-surface-container to-surface-container-low p-space-md shadow-xl">
            <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-installment/15 text-installment-text mb-1">
              <span className="material-symbols-outlined text-[12px]">bolt</span>
              <span className="font-label-sm text-label-sm uppercase tracking-wider font-bold">{t('home.installmentBadge')}</span>
            </div>
            <h2 className="font-headline-lg-mobile text-headline-lg-mobile text-on-surface font-extrabold leading-tight tracking-tight max-w-[70%]">
              {t('home.bannerTitle')}
            </h2>
            <p className="font-body-sm text-body-sm text-on-surface-variant max-w-[80%] mb-space-sm">{t('home.bannerText')}</p>
            <button
              type="button"
              onClick={() => navigate('/catalog')}
              className="h-10 px-space-md rounded-full bg-primary text-on-primary font-label-lg text-label-lg font-bold flex items-center gap-1.5"
            >
              <span>{t('home.bannerCta')}</span>
              <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
            </button>
          </div>
        </section>

        <section className="w-full space-y-space-sm">
          <div className="flex items-center justify-between">
            <h3 className="font-headline-md text-headline-md text-on-surface">{t('home.categories')}</h3>
            <button type="button" onClick={() => navigate('/catalog')} className="font-label-sm text-label-sm text-primary-text flex items-center gap-0.5">
              {t('home.seeAll')}
              <span className="material-symbols-outlined text-[14px]">chevron_right</span>
            </button>
          </div>
          {categoriesLoading ? (
            <div className="grid grid-cols-4 gap-space-sm">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-20" />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-4 gap-space-sm">
              {visibleCategories.map((category) => (
                <button
                  key={category.id}
                  type="button"
                  onClick={() => navigate(`/products?category=${category.id}`)}
                  className="flex flex-col items-center gap-1.5 p-2 rounded-xl bg-surface-container text-center"
                >
                  <span className="w-11 h-11 rounded-full bg-primary/10 text-primary-text flex items-center justify-center overflow-hidden">
                    {category.image_path !== null ? (
                      <img src={mediaUrl(category.image_path) ?? undefined} alt="" loading="lazy" className="w-full h-full object-contain" />
                    ) : (
                      <span className="material-symbols-outlined text-[22px]">{category.icon ?? 'smartphone'}</span>
                    )}
                  </span>
                  <span className="font-label-sm text-label-sm text-on-surface font-medium leading-tight line-clamp-2">
                    {category.name}
                  </span>
                </button>
              ))}
            </div>
          )}
        </section>

        <section className="w-full space-y-space-sm">
          <h3 className="font-headline-md text-headline-md text-on-surface">{t('home.trending')}</h3>
          {trendingQuery.isLoading ? (
            <div className="grid grid-cols-2 gap-space-sm">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-64" />
              ))}
            </div>
          ) : trendingQuery.isError ? (
            <ErrorState onRetry={() => trendingQuery.refetch()} />
          ) : (
            <div className="grid grid-cols-2 gap-space-sm">
              {trending.map((product) => (
                <ProductCard key={product.id} product={product} onOpen={setOpenProduct} />
              ))}
            </div>
          )}
        </section>

        <section className="w-full">
          <div className="rounded-xl bg-surface-container p-space-md flex flex-col gap-space-xs">
            <div className="flex items-center gap-space-sm">
              <span className="material-symbols-outlined text-primary-text text-[24px]">verified</span>
              <h3 className="text-body-lg font-body-lg text-on-surface font-semibold">{t('home.guaranteeTitle')}</h3>
            </div>
            <p className="text-body-sm font-body-sm text-on-surface-variant">{t('home.guaranteeText')}</p>
          </div>
        </section>

        {config.channelUsername.length > 0 && (
          <section className="w-full">
            <button
              type="button"
              onClick={handleOpenChannel}
              className="w-full flex items-center gap-space-sm bg-secondary/10 rounded-xl px-space-md py-space-sm"
            >
              <span className="material-symbols-outlined text-secondary text-[20px]">send</span>
              <span className="flex-1 text-left text-body-sm font-body-sm text-on-surface">{t('home.channelCta')}</span>
              <span className="material-symbols-outlined text-[16px] text-on-surface-variant">arrow_forward</span>
            </button>
          </section>
        )}
      </main>

      {openProduct !== null && <ProductSheet product={openProduct} onClose={() => setOpenProduct(null)} />}
      <RegionPicker open={regionPickerOpen} onClose={() => setRegionPickerOpen(false)} />
    </div>
  );
}

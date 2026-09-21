import { useRegions } from '../lib/queries.ts';
import { setSelectedRegionId, useSelectedRegionId } from '../lib/region.ts';
import { t } from '../lib/i18n.ts';

export function RegionPicker({ open, onClose }: { open: boolean; onClose: () => void }): JSX.Element | null {
  const { data: regions } = useRegions();
  const selectedId = useSelectedRegionId();
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end" role="dialog" aria-modal="true">
      <button type="button" aria-label={t('common.close')} className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative w-full bg-surface-container-low rounded-t-2xl p-margin pb-safe max-h-[70vh] overflow-y-auto">
        <h3 className="text-headline-md font-headline-md text-on-surface mb-space-md">{t('regions.title')}</h3>
        <div className="flex flex-col gap-1">
          {(regions ?? []).map((region) => (
            <button
              key={region.id}
              type="button"
              onClick={() => {
                setSelectedRegionId(region.id);
                onClose();
              }}
              className={`text-left min-h-[48px] px-space-sm rounded-xl flex items-center justify-between ${
                selectedId === region.id ? 'text-primary-text' : 'text-on-surface'
              }`}
            >
              <span className="text-body-lg font-body-lg">{region.name}</span>
              {region.eta_text !== null && (
                <span className="text-label-sm font-label-sm text-on-surface-variant">{region.eta_text}</span>
              )}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useAddresses } from '../lib/queries.ts';
import { useTelegramBackButton } from '../lib/useBackButton.ts';
import { getClient } from '../lib/client.ts';
import { ErrorState, Skeleton } from '../components/States.tsx';
import { t } from '../lib/i18n.ts';

export function Addresses(): JSX.Element {
  useTelegramBackButton('/profile');
  const queryClient = useQueryClient();
  const { data: addresses, isLoading, isError, refetch } = useAddresses();
  const [newText, setNewText] = useState('');

  const invalidate = (): Promise<void> => queryClient.invalidateQueries({ queryKey: ['addresses'] }).then(() => undefined);

  const handleAdd = async (): Promise<void> => {
    if (newText.trim().length === 0) return;
    const client = await getClient();
    await client.postAddress({
      regionId: null,
      label: null,
      text: newText.trim(),
      lat: null,
      lng: null,
      isDefault: (addresses?.length ?? 0) === 0,
    });
    setNewText('');
    await invalidate();
  };

  const handleSetDefault = async (id: number, text: string, regionId: number | null): Promise<void> => {
    const client = await getClient();
    await client.patchAddress(id, { regionId, label: null, text, lat: null, lng: null, isDefault: true });
    await invalidate();
  };

  const handleDelete = async (id: number): Promise<void> => {
    const client = await getClient();
    await client.deleteAddress(id);
    await invalidate();
  };

  return (
    <div className="flex flex-col min-h-screen pb-24">
      <header className="sticky top-0 z-30 bg-surface/90 backdrop-blur-xl pt-safe px-margin h-14 flex items-center shadow-sm">
        <h1 className="text-headline-md font-headline-md text-on-surface">{t('addresses.title')}</h1>
      </header>
      <main className="px-margin pt-space-md flex flex-col gap-space-sm">
        {isLoading ? (
          Array.from({ length: 2 }).map((_, i) => <Skeleton key={i} className="h-16" />)
        ) : isError ? (
          <ErrorState onRetry={() => refetch()} />
        ) : (addresses?.length ?? 0) === 0 ? (
          <p className="text-body-md font-body-md text-on-surface-variant text-center py-space-lg">{t('addresses.empty')}</p>
        ) : (
          addresses!.map((address) => (
            <div key={address.id} className="bg-surface-container rounded-xl p-space-md shadow-sm flex items-center justify-between gap-space-sm">
              <div className="min-w-0">
                <p className="text-body-md font-body-md text-on-surface truncate">{address.text}</p>
                {address.is_default && <span className="text-label-sm font-label-sm text-primary">{t('addresses.default')}</span>}
              </div>
              <div className="flex items-center gap-space-sm flex-shrink-0">
                {!address.is_default && (
                  <button
                    type="button"
                    onClick={() => void handleSetDefault(address.id, address.text, address.region_id)}
                    className="text-label-sm font-label-sm text-primary min-h-[44px]"
                  >
                    {t('addresses.setDefault')}
                  </button>
                )}
                <button type="button" onClick={() => void handleDelete(address.id)} className="text-label-sm font-label-sm text-error min-h-[44px]">
                  {t('addresses.delete')}
                </button>
              </div>
            </div>
          ))
        )}

        <div className="flex flex-col gap-space-sm mt-space-sm">
          <textarea
            value={newText}
            onChange={(e) => setNewText(e.target.value)}
            placeholder={t('checkout.addressText')}
            aria-label={t('checkout.addressText')}
            className="w-full rounded-xl border border-outline-variant/40 bg-transparent px-space-md py-space-sm text-body-md font-body-md focus:outline-primary"
            rows={2}
          />
          <button type="button" onClick={() => void handleAdd()} className="h-11 rounded-full bg-primary text-on-primary text-label-lg font-label-lg">
            {t('addresses.add')}
          </button>
        </div>
      </main>
    </div>
  );
}

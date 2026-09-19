import { useRef, useState } from 'react';
import { ImageProcessingError, processImageForUpload } from '../../lib/image.ts';
import { t } from '../../lib/i18n.ts';

interface ImageUploadProps {
  currentUrl: string | null;
  onUpload: (thumb: Blob, main: Blob) => Promise<void>;
  pending: boolean;
}

function kb(bytes: number): string {
  return `${(bytes / 1024).toFixed(1)} KB`;
}

/** Client-side WebP pipeline UI: pick a file, resize+encode locally (thumb
 * 400px / main 1000px), show a preview + resulting sizes, then hand the two
 * blobs to `onUpload` (the caller does the actual multipart POST — the
 * upload target, e.g. /admin/variants/:id/image or /admin/banners/:id/image,
 * is the caller's choice, not this component's). */
export function ImageUpload({ currentUrl, onUpload, pending }: ImageUploadProps): JSX.Element {
  const inputRef = useRef<HTMLInputElement>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [sizes, setSizes] = useState<{ thumb: number; main: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleFile(file: File): Promise<void> {
    setError(null);
    try {
      const { thumb, main } = await processImageForUpload(file);
      setPreviewUrl(URL.createObjectURL(main));
      setSizes({ thumb: thumb.size, main: main.size });
      await onUpload(thumb, main);
    } catch (err) {
      if (err instanceof ImageProcessingError) {
        setError(err.message);
      } else {
        setError(t('admin.image.error'));
      }
    }
  }

  const displayUrl = previewUrl ?? currentUrl;

  return (
    <div className="flex flex-col gap-space-sm">
      <div className="flex items-center gap-space-md">
        <div className="w-20 h-20 rounded-xl bg-surface-container overflow-hidden flex items-center justify-center flex-shrink-0">
          {displayUrl !== null ? (
            <img src={displayUrl} alt="" className="w-full h-full object-cover" />
          ) : (
            <span className="material-symbols-outlined text-on-surface-variant">image</span>
          )}
        </div>
        <div className="flex flex-col gap-space-xs">
          <button
            type="button"
            disabled={pending}
            onClick={() => inputRef.current?.click()}
            className="min-h-[44px] px-space-md rounded-xl bg-surface-container text-on-surface text-label-md font-label-md disabled:opacity-50"
          >
            {t('admin.image.pick')}
          </button>
          {sizes !== null && (
            <p className="text-body-sm font-body-sm text-on-surface-variant">
              thumb {kb(sizes.thumb)} &middot; main {kb(sizes.main)}
            </p>
          )}
        </div>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = '';
          if (file !== undefined) void handleFile(file);
        }}
      />
      {error !== null && <p className="text-body-sm font-body-sm text-error">{error}</p>}
    </div>
  );
}

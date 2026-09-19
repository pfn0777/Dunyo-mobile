// Browser-side image pipeline for the admin panel (phase 4b): decode ->
// resize (long side) -> re-encode as WebP at two sizes. Per spec: thumbnail
// 400px q=0.80, main 1000px q=0.82, never upscale, reject anything >= 1 MB,
// and detect browsers that silently fall back to PNG when asked for WebP.
// Kept in phase 4a because its pure `computeResizedDimensions` helper is
// covered by lib/__tests__/image.test.ts (ported from XUMO) and the admin
// panel will import the rest of this module unchanged in phase 4b.

export const THUMB_LONG_SIDE_PX = 400;
export const THUMB_QUALITY = 0.8;
export const MAIN_LONG_SIDE_PX = 1000;
export const MAIN_QUALITY = 0.82;
export const MAX_UPLOAD_BYTES = 1 * 1024 * 1024; // 1 MB, matches WEBP_MAX_BYTES server-side.
const WEBP_MIME = 'image/webp';

export class ImageProcessingError extends Error {
  readonly code: 'unsupported_webp' | 'decode_failed' | 'too_large';
  constructor(code: ImageProcessingError['code'], message: string) {
    super(message);
    this.name = 'ImageProcessingError';
    this.code = code;
  }
}

/**
 * Pure dimension calculator: scales `width x height` so its LONG side equals
 * `targetLongSide`, preserving aspect ratio, and NEVER upscales (if the
 * image's long side is already <= target, dimensions are returned unchanged).
 * Rounds to the nearest integer pixel.
 */
export function computeResizedDimensions(
  width: number,
  height: number,
  targetLongSide: number,
): { width: number; height: number } {
  const longSide = Math.max(width, height);
  if (longSide <= targetLongSide) {
    return { width, height };
  }
  const scale = targetLongSide / longSide;
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}

async function decodeToDrawable(file: File): Promise<{ source: CanvasImageSource; width: number; height: number; cleanup: () => void }> {
  if (typeof createImageBitmap === 'function') {
    try {
      const bitmap = await createImageBitmap(file);
      return { source: bitmap, width: bitmap.width, height: bitmap.height, cleanup: () => bitmap.close() };
    } catch (error) {
      console.warn('image: createImageBitmap failed, falling back to <img> decode', error);
    }
  }
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    const loaded = new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new ImageProcessingError('decode_failed', 'Failed to decode image'));
    });
    img.src = url;
    await loaded;
    return { source: img, width: img.naturalWidth, height: img.naturalHeight, cleanup: () => URL.revokeObjectURL(url) };
  } catch (error) {
    URL.revokeObjectURL(url);
    throw error;
  }
}

function canvasToWebpBlob(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob === null) {
          reject(new ImageProcessingError('decode_failed', 'Canvas encode failed'));
          return;
        }
        if (blob.type !== WEBP_MIME) {
          reject(
            new ImageProcessingError(
              'unsupported_webp',
              "Brauzeringiz WebP'ni qo'llamaydi, Telegram Desktop'dan foydalaning",
            ),
          );
          return;
        }
        resolve(blob);
      },
      WEBP_MIME,
      quality,
    );
  });
}

async function renderVariant(
  source: CanvasImageSource,
  srcWidth: number,
  srcHeight: number,
  targetLongSide: number,
  quality: number,
): Promise<Blob> {
  const { width, height } = computeResizedDimensions(srcWidth, srcHeight, targetLongSide);
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (ctx === null) {
    throw new ImageProcessingError('decode_failed', 'Canvas 2D context unavailable');
  }
  ctx.drawImage(source, 0, 0, width, height);
  const blob = await canvasToWebpBlob(canvas, quality);
  if (blob.size >= MAX_UPLOAD_BYTES) {
    throw new ImageProcessingError('too_large', 'Rasm hajmi 1 MB dan katta');
  }
  return blob;
}

export interface ProcessedImage {
  thumb: Blob;
  main: Blob;
}

/** Decodes `file`, then produces the thumb (400px, q=0.80) and main
 * (1000px, q=0.82) WebP variants per spec. Never upscales smaller images. */
export async function processImageForUpload(file: File): Promise<ProcessedImage> {
  const { source, width, height, cleanup } = await decodeToDrawable(file);
  try {
    const [thumb, main] = await Promise.all([
      renderVariant(source, width, height, THUMB_LONG_SIDE_PX, THUMB_QUALITY),
      renderVariant(source, width, height, MAIN_LONG_SIDE_PX, MAIN_QUALITY),
    ]);
    return { thumb, main };
  } finally {
    cleanup();
  }
}

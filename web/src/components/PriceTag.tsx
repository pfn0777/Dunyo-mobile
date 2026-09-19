import { formatSom } from '../lib/format.ts';
export { discountPercent } from '../lib/discount.ts';

export function PriceTag({ price, oldPrice }: { price: number; oldPrice: number | null }): JSX.Element {
  return (
    <div className="flex flex-col gap-0.5 min-w-0">
      <span className="text-price-headline font-price-headline text-on-surface whitespace-nowrap overflow-hidden text-ellipsis">
        {formatSom(price)}
      </span>
      {oldPrice !== null && (
        <span className="text-body-sm font-body-sm text-on-surface-variant line-through whitespace-nowrap overflow-hidden text-ellipsis">
          {formatSom(oldPrice)}
        </span>
      )}
    </div>
  );
}

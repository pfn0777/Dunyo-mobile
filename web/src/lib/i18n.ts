import uz from '../locales/uz.json';

type Dict = Record<string, string>;
const dict: Dict = uz;

/** Tiny interpolating translator: t('home.freeDeliveryFrom', { amount: '15 000 so'm' }). */
export function t(key: string, params?: Record<string, string | number>): string {
  const template = dict[key] ?? key;
  if (params === undefined) {
    return template;
  }
  return Object.entries(params).reduce(
    (result, [paramKey, value]) => result.replaceAll(`{{${paramKey}}}`, String(value)),
    template,
  );
}

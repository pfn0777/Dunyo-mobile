const SOM_SUFFIX = "so'm";
const THOUSANDS_GROUP_SIZE = 3;

/**
 * Formats an integer amount of so'm as "67 500 so'm" using a regular
 * space as the thousands separator. Intl.NumberFormat is avoided because
 * its grouping separator character differs across JS runtimes (Node vs Deno).
 */
export function formatSom(amount: number): string {
  if (!Number.isInteger(amount)) {
    throw new Error(`formatSom: amount must be an integer, got ${amount}`);
  }
  const negative = amount < 0;
  const digits = Math.abs(amount).toString();
  const groups: string[] = [];
  for (let end = digits.length; end > 0; end -= THOUSANDS_GROUP_SIZE) {
    const start = Math.max(0, end - THOUSANDS_GROUP_SIZE);
    groups.unshift(digits.slice(start, end));
  }
  const grouped = groups.join(' ');
  return `${negative ? '-' : ''}${grouped} ${SOM_SUFFIX}`;
}

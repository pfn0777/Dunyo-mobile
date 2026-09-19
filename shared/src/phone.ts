const UZ_COUNTRY_CODE = '998';
const UZ_LOCAL_NUMBER_LENGTH = 9;
const STRIPPABLE_CHARS = /[\s()-]/g;

/**
 * Normalizes a Uzbek phone number to the canonical "+998XXXXXXXXX" form.
 * Accepts "+998XXXXXXXXX", "998XXXXXXXXX", and a bare 9-digit local number.
 * Returns null for anything else (other country codes, wrong length, non-digits).
 */
export function normalizePhone(input: string): string | null {
  const stripped = input.replace(STRIPPABLE_CHARS, '');
  if (!/^\+?\d+$/.test(stripped)) {
    return null;
  }
  const digits = stripped.startsWith('+') ? stripped.slice(1) : stripped;

  if (digits.length === UZ_LOCAL_NUMBER_LENGTH) {
    return `+${UZ_COUNTRY_CODE}${digits}`;
  }

  if (
    digits.length === UZ_COUNTRY_CODE.length + UZ_LOCAL_NUMBER_LENGTH &&
    digits.startsWith(UZ_COUNTRY_CODE)
  ) {
    return `+${digits}`;
  }

  return null;
}

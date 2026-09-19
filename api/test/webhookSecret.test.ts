import { describe, expect, it } from 'vitest';
import { isValidWebhookSecret } from '../src/lib/webhookSecret';

describe('isValidWebhookSecret', () => {
  it('accepts a matching secret', () => {
    expect(isValidWebhookSecret('abc123', 'abc123')).toBe(true);
  });

  it('rejects a mismatched secret', () => {
    expect(isValidWebhookSecret('abc124', 'abc123')).toBe(false);
  });

  it('rejects a missing header', () => {
    expect(isValidWebhookSecret(null, 'abc123')).toBe(false);
  });

  it('rejects different-length secrets', () => {
    expect(isValidWebhookSecret('abc', 'abc123')).toBe(false);
  });
});

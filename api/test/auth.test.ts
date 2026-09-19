import { describe, expect, it } from 'vitest';
import { extractInitData } from '../src/lib/auth';

describe('extractInitData', () => {
  it('extracts the value after the "tma" scheme', () => {
    expect(extractInitData('tma query_id=abc&hash=x')).toBe('query_id=abc&hash=x');
  });

  it('rejects a missing header', () => {
    expect(extractInitData(null)).toBeNull();
  });

  it('rejects the wrong scheme', () => {
    expect(extractInitData('Bearer abc')).toBeNull();
  });

  it('rejects an empty value', () => {
    expect(extractInitData('tma ')).toBeNull();
  });
});

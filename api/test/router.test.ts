import { describe, expect, it } from 'vitest';
import { matchPath, stripPrefix } from '../src/lib/router';

describe('matchPath', () => {
  it('matches literal segments exactly', () => {
    expect(matchPath('/me', '/me')).toEqual({ params: {} });
    expect(matchPath('/me', '/you')).toBeNull();
  });

  it('captures a single param', () => {
    expect(matchPath('/orders/:id', '/orders/42')).toEqual({ params: { id: '42' } });
  });

  it('captures multiple params', () => {
    expect(matchPath('/products/:id/image', '/products/7/image')).toEqual({ params: { id: '7' } });
  });

  it('rejects mismatched segment count', () => {
    expect(matchPath('/orders/:id', '/orders/42/status')).toBeNull();
    expect(matchPath('/orders/:id/status', '/orders/42')).toBeNull();
  });

  it('rejects an empty param segment', () => {
    expect(matchPath('/orders/:id', '/orders/')).toBeNull();
  });
});

describe('stripPrefix', () => {
  it('removes the api prefix', () => {
    expect(stripPrefix('/api', '/api/me')).toBe('/me');
    expect(stripPrefix('/api', '/api')).toBe('/');
    expect(stripPrefix('/api', '/other')).toBeNull();
  });
});

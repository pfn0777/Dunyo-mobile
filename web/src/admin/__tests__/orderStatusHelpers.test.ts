import { describe, expect, it } from 'vitest';
import { allowedNextStatuses } from '../orderStatusHelpers.ts';

describe('allowedNextStatuses', () => {
  it('new -> confirmed | cancelled, regardless of delivery type', () => {
    expect(allowedNextStatuses('new', 'delivery')).toEqual(['confirmed', 'cancelled']);
    expect(allowedNextStatuses('new', 'pickup')).toEqual(['confirmed', 'cancelled']);
  });

  it('delivery confirmed offers shipped, on_the_way and cancelled', () => {
    expect(allowedNextStatuses('confirmed', 'delivery')).toEqual(['shipped', 'on_the_way', 'cancelled']);
  });

  it('pickup confirmed does NOT offer shipped, but does offer delivered directly', () => {
    expect(allowedNextStatuses('confirmed', 'pickup')).toEqual(['on_the_way', 'delivered', 'cancelled']);
  });

  it('shipped -> on_the_way | delivered | cancelled', () => {
    expect(allowedNextStatuses('shipped', 'delivery')).toEqual(['on_the_way', 'delivered', 'cancelled']);
  });

  it('on_the_way -> delivered | cancelled', () => {
    expect(allowedNextStatuses('on_the_way', 'delivery')).toEqual(['delivered', 'cancelled']);
  });

  it('delivered and cancelled are terminal (no further transitions)', () => {
    expect(allowedNextStatuses('delivered', 'delivery')).toEqual([]);
    expect(allowedNextStatuses('cancelled', 'pickup')).toEqual([]);
  });
});

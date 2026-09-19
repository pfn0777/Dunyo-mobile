import { describe, expect, it } from 'vitest';
import { canTransition, isTerminal } from '../src/orderStatus.ts';

describe('canTransition', () => {
  it('allows every documented transition out of new', () => {
    expect(canTransition('new', 'confirmed', 'delivery')).toBe(true);
    expect(canTransition('new', 'cancelled', 'delivery')).toBe(true);
  });

  it('allows every documented transition out of confirmed', () => {
    expect(canTransition('confirmed', 'shipped', 'delivery')).toBe(true);
    expect(canTransition('confirmed', 'on_the_way', 'delivery')).toBe(true);
    expect(canTransition('confirmed', 'cancelled', 'delivery')).toBe(true);
  });

  it('allows every documented transition out of shipped', () => {
    expect(canTransition('shipped', 'on_the_way', 'delivery')).toBe(true);
    expect(canTransition('shipped', 'delivered', 'delivery')).toBe(true);
    expect(canTransition('shipped', 'cancelled', 'delivery')).toBe(true);
  });

  it('allows every documented transition out of on_the_way', () => {
    expect(canTransition('on_the_way', 'delivered', 'delivery')).toBe(true);
    expect(canTransition('on_the_way', 'cancelled', 'delivery')).toBe(true);
  });

  it('allows confirmed -> delivered only for pickup', () => {
    expect(canTransition('confirmed', 'delivered', 'pickup')).toBe(true);
    expect(canTransition('confirmed', 'delivered', 'delivery')).toBe(false);
  });

  it('rejects shipped as a pickup transition target from confirmed (still allowed, shipped is generic)', () => {
    // shipped is a normal table transition regardless of deliveryType; the
    // UI simply never offers it for pickup orders.
    expect(canTransition('confirmed', 'shipped', 'pickup')).toBe(true);
  });

  it('rejects disallowed transitions', () => {
    expect(canTransition('delivered', 'new', 'delivery')).toBe(false);
    expect(canTransition('cancelled', 'cancelled', 'delivery')).toBe(false);
    expect(canTransition('delivered', 'delivered', 'delivery')).toBe(false);
    expect(canTransition('new', 'on_the_way', 'delivery')).toBe(false);
    expect(canTransition('new', 'shipped', 'delivery')).toBe(false);
  });

  it('treats delivered and cancelled as fully terminal, including no self-transition', () => {
    expect(canTransition('delivered', 'delivered', 'delivery')).toBe(false);
    expect(canTransition('delivered', 'delivered', 'pickup')).toBe(false);
    expect(canTransition('cancelled', 'cancelled', 'pickup')).toBe(false);
  });
});

describe('isTerminal', () => {
  it('flags delivered and cancelled as terminal', () => {
    expect(isTerminal('delivered')).toBe(true);
    expect(isTerminal('cancelled')).toBe(true);
  });

  it('flags every other status as non-terminal', () => {
    expect(isTerminal('new')).toBe(false);
    expect(isTerminal('confirmed')).toBe(false);
    expect(isTerminal('shipped')).toBe(false);
    expect(isTerminal('on_the_way')).toBe(false);
  });
});

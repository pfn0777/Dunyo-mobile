import { useSyncExternalStore } from 'react';
import { cartStore, type CartLine } from './cart.ts';

export function useCartLines(): CartLine[] {
  return useSyncExternalStore(cartStore.subscribe, cartStore.getSnapshot);
}

export function useCartCount(): number {
  const lines = useCartLines();
  return lines.reduce((sum, l) => sum + l.qty, 0);
}

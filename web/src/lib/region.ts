// Shared "selected delivery region" state (localStorage-backed), read by the
// Home header picker, the cart/checkout totals (calcTotals needs
// regionDeliveryFee/regionFreeThreshold) and the Checkout region picker.
// Not part of the order until checkout submits it — this is only a UI
// convenience so the header and cart agree on which region's price to show.

import { useSyncExternalStore } from 'react';

const STORAGE_KEY = 'dunyo.selectedRegionId';

type Listener = () => void;
const listeners = new Set<Listener>();

function readInitial(): number | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw !== null && raw.length > 0 ? Number(raw) : null;
  } catch (error) {
    console.error('region: failed to read localStorage', error);
    return null;
  }
}

let selectedRegionId: number | null = readInitial();

export function getSelectedRegionIdSnapshot(): number | null {
  return selectedRegionId;
}

export function setSelectedRegionId(id: number | null): void {
  selectedRegionId = id;
  try {
    if (id === null) {
      window.localStorage.removeItem(STORAGE_KEY);
    } else {
      window.localStorage.setItem(STORAGE_KEY, String(id));
    }
  } catch (error) {
    console.error('region: failed to persist localStorage', error);
  }
  for (const listener of listeners) listener();
}

export function subscribeSelectedRegion(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useSelectedRegionId(): number | null {
  return useSyncExternalStore(subscribeSelectedRegion, getSelectedRegionIdSnapshot);
}

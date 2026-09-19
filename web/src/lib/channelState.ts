// Global "must join the channel" flag, flipped by api.ts whenever a request
// comes back 403 channel_required. Consumed by RequireSubscription so the gate
// appears even if the ['me'] query is still serving a stale allowed snapshot.

type Listener = () => void;

let required = false;
const listeners = new Set<Listener>();

export function subscribeChannelRequired(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getChannelRequiredSnapshot(): boolean {
  return required;
}

export function setChannelRequired(value: boolean): void {
  if (required === value) return;
  required = value;
  for (const listener of listeners) listener();
}

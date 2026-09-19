// Global "must reopen via bot" flag, flipped by api.ts whenever a request
// comes back 401 auth_invalid. Consumed by RequireAuth so every private
// screen reacts the same way without each page wiring its own 401 handling.

type Listener = () => void;

let invalid = false;
const listeners = new Set<Listener>();

export function subscribeAuthInvalid(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getAuthInvalidSnapshot(): boolean {
  return invalid;
}

export function setAuthInvalid(value: boolean): void {
  if (invalid === value) return;
  invalid = value;
  for (const listener of listeners) listener();
}

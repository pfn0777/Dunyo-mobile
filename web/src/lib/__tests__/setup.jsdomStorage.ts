// Node's own experimental global `localStorage`/`sessionStorage` (added in
// recent Node versions) shadows jsdom's implementation when running under
// vitest's jsdom environment without a --localstorage-file flag, leaving
// window.localStorage undefined. This installs a minimal in-memory
// polyfill directly on window so cart/idempotency tests have a working store.
class MemoryStorage implements Storage {
  private store = new Map<string, string>();
  get length(): number {
    return this.store.size;
  }
  clear(): void {
    this.store.clear();
  }
  getItem(key: string): string | null {
    return this.store.has(key) ? this.store.get(key)! : null;
  }
  key(index: number): string | null {
    return Array.from(this.store.keys())[index] ?? null;
  }
  removeItem(key: string): void {
    this.store.delete(key);
  }
  setItem(key: string, value: string): void {
    this.store.set(key, value);
  }
}

if (typeof window !== 'undefined') {
  Object.defineProperty(window, 'localStorage', { value: new MemoryStorage(), configurable: true });
  Object.defineProperty(window, 'sessionStorage', { value: new MemoryStorage(), configurable: true });
}

import '@testing-library/jest-dom';

// Node.js v22 defines globalThis.localStorage as undefined (experimental Web Storage API),
// which prevents happy-dom/jsdom from installing their own implementation.
// Provide a minimal in-memory mock so tests that touch localStorage work.
if (typeof globalThis.localStorage === 'undefined') {
  const store: Record<string, string> = {};
  globalThis.localStorage = {
    getItem: (k: string) => store[k] ?? null,
    setItem: (k: string, v: string) => { store[k] = String(v); },
    removeItem: (k: string) => { delete store[k]; },
    clear: () => { Object.keys(store).forEach(k => delete store[k]); },
    key: (i: number) => Object.keys(store)[i] ?? null,
    get length() { return Object.keys(store).length; },
  } as Storage;
}

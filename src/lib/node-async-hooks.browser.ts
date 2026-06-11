/**
 * Browser stand-in for `node:async_hooks`'s AsyncLocalStorage.
 *
 * `@tanstack/start-storage-context` constructs an AsyncLocalStorage at module
 * scope. In production the client bundle tree-shakes that module away
 * (`sideEffects: false`), but the dev server doesn't tree-shake, so the client
 * graph hits Vite's browser-external stub and crashes before hydration.
 * The vite config aliases `node:async_hooks` to this file for the client
 * environment only; the server keeps the real Node implementation.
 *
 * Synchronous-context semantics are enough here: on the client TanStack Start
 * only ever calls `getStore()` outside `run()`, which must return `undefined`.
 */
export class AsyncLocalStorage<T> {
  private store: T | undefined;

  run<R>(store: T, fn: (...args: Array<unknown>) => R, ...args: Array<unknown>): R {
    const prev = this.store;
    this.store = store;
    try {
      return fn(...args);
    } finally {
      this.store = prev;
    }
  }

  exit<R>(fn: (...args: Array<unknown>) => R, ...args: Array<unknown>): R {
    const prev = this.store;
    this.store = undefined;
    try {
      return fn(...args);
    } finally {
      this.store = prev;
    }
  }

  getStore(): T | undefined {
    return this.store;
  }

  enterWith(store: T): void {
    this.store = store;
  }

  disable(): void {
    this.store = undefined;
  }
}

export default { AsyncLocalStorage };

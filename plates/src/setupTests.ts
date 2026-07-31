import '@testing-library/jest-dom/vitest'

// Newer Node versions ship an experimental global `localStorage` that can
// shadow jsdom's own implementation under Vitest and, without a
// `--localstorage-file` path configured, resolves to a non-functional stub
// (every method undefined). activeWorkoutDraft.ts's persistence tests need
// a real Storage, so patch in a minimal in-memory one whenever the
// environment's version is unusable - real browsers are unaffected since
// this only fires when `getItem` isn't actually a function.
if (typeof window !== 'undefined' && typeof window.localStorage?.getItem !== 'function') {
  class InMemoryStorage implements Storage {
    private data = new Map<string, string>()

    getItem(key: string): string | null {
      return this.data.has(key) ? this.data.get(key)! : null
    }
    setItem(key: string, value: string): void {
      this.data.set(key, value)
    }
    removeItem(key: string): void {
      this.data.delete(key)
    }
    clear(): void {
      this.data.clear()
    }
    key(index: number): string | null {
      return Array.from(this.data.keys())[index] ?? null
    }
    get length(): number {
      return this.data.size
    }
  }

  Object.defineProperty(window, 'localStorage', { value: new InMemoryStorage(), configurable: true, writable: true })
}

// jsdom doesn't implement the Web Animations API, which Svelte 5's built-in
// transitions (fly, fade, etc.) call via `element.animate(...)`. Real
// browsers all support this natively - stub just enough of the Animation
// interface for transitions to run to completion without erroring in tests.
if (typeof Element !== 'undefined' && typeof Element.prototype.animate !== 'function') {
  Element.prototype.animate = function () {
    return {
      cancel: () => {},
      finish: () => {},
      play: () => {},
      pause: () => {},
      finished: Promise.resolve(),
      effect: null,
      currentTime: 0,
      playState: 'finished',
      onfinish: null,
      oncancel: null,
      addEventListener: () => {},
      removeEventListener: () => {},
    } as unknown as Animation
  }
}

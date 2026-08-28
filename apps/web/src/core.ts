import type * as CoreModule from '@systemsextant/core';

/**
 * Loads the environment-neutral core package on demand.
 *
 * The core package pulls in `yaml` and `zod`, which together dominate the bundle
 * size but are only needed once the user edits or generates an architecture.
 * Importing it dynamically keeps those bytes off the initial render path while
 * `preloadCore` (called after first paint) warms the same chunk in the
 * background so it is ready before the first interaction that needs it.
 */
let corePromise: Promise<typeof CoreModule> | undefined;

export function loadCore(): Promise<typeof CoreModule> {
  corePromise ??= import('@systemsextant/core');
  return corePromise;
}

/** Preloads the core chunk without blocking the caller; errors are ignorable retries. */
export function preloadCore(): void {
  void loadCore().catch(() => {
    corePromise = undefined;
  });
}

export type Core = typeof CoreModule;

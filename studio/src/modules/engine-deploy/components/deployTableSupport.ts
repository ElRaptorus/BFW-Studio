export const DEPLOY_PAGE_SIZE_OPTIONS = [25, 50, 100, 250];

export function matchesDeployTextFilter(haystack: string, filter: string): boolean {
  return filter.trim() === '' || haystack.toLowerCase().includes(filter.trim().toLowerCase());
}

/** TanStack hands state setters either a value or an updater function. */
export function resolveUpdater<T>(updater: T | ((previous: T) => T), previous: T): T {
  return typeof updater === 'function' ? (updater as (previous: T) => T)(previous) : updater;
}

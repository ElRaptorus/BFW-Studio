const EVENT_NAME = 'settings:navigate-to-category';

let pendingCategory: string | null = null;

export function requestCategoryNavigation(category: string): void {
  pendingCategory = category;
  window.dispatchEvent(new CustomEvent(EVENT_NAME, { detail: category }));
}

export function consumePendingCategory(): string | null {
  const value = pendingCategory;
  pendingCategory = null;
  return value;
}

export function onCategoryNavigationRequested(callback: (category: string) => void): () => void {
  const handler = (event: Event): void => {
    callback((event as CustomEvent<string>).detail);
  };
  window.addEventListener(EVENT_NAME, handler);
  return () => window.removeEventListener(EVENT_NAME, handler);
}

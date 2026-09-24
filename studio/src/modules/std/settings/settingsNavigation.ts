import type { SettingsScopeTarget } from '#bifrost/contracts/SettingsScopeTypes';

const EVENT_NAME = 'settings:navigate-to-category';
const SCOPE_EVENT_NAME = 'settings:navigate-to-scope';

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

let pendingScope: SettingsScopeTarget | null = null;

export function requestScopeNavigation(target: SettingsScopeTarget): void {
  pendingScope = target;
  window.dispatchEvent(new CustomEvent(SCOPE_EVENT_NAME, { detail: target }));
}

export function peekPendingScope(): SettingsScopeTarget | null {
  return pendingScope;
}

export function clearPendingScope(): void {
  pendingScope = null;
}

export function onScopeNavigationRequested(callback: (target: SettingsScopeTarget) => void): () => void {
  const handler = (event: Event): void => {
    pendingScope = null;
    callback((event as CustomEvent<SettingsScopeTarget>).detail);
  };
  window.addEventListener(SCOPE_EVENT_NAME, handler);
  return () => window.removeEventListener(SCOPE_EVENT_NAME, handler);
}

export function onCategoryNavigationRequested(callback: (category: string) => void): () => void {
  const handler = (event: Event): void => {
    callback((event as CustomEvent<string>).detail);
  };
  window.addEventListener(EVENT_NAME, handler);
  return () => window.removeEventListener(EVENT_NAME, handler);
}

import type { PluginDiagnostic, PluginDiagnosticCounts } from './types';

/**
 * Diagnostics API for contributing errors, warnings, and info messages.
 *
 * The `owner` for all operations is automatically set to the plugin's name —
 * plugins cannot interfere with diagnostics contributed by other plugins.
 */
export interface DiagnosticsApi {
  /**
   * Set diagnostics for a URI. Replaces any previously set diagnostics
   * for this plugin on the same URI.
   *
   * Pass an empty array to clear diagnostics for a specific URI.
   *
   * @param uri - The resource URI these diagnostics apply to.
   * @param diagnostics - The diagnostics to set.
   */
  set(uri: string, diagnostics: PluginDiagnostic[]): Promise<void>;

  /**
   * Clear all diagnostics contributed by this plugin across all URIs.
   */
  clear(): Promise<void>;

  /**
   * Get diagnostics, optionally filtered by URI.
   *
   * Returns a record mapping URIs to their diagnostic arrays.
   * When called without a URI, returns diagnostics for all URIs.
   *
   * @param uri - Optional URI to filter by.
   */
  get(uri?: string): Promise<Record<string, PluginDiagnostic[]>>;

  /**
   * Get the total diagnostic counts across all URIs and owners.
   */
  getCount(): Promise<PluginDiagnosticCounts>;

  /**
   * Register a callback that fires whenever diagnostics change
   * (from any owner, not just this plugin).
   *
   * @param callback - Invoked on every diagnostic change event.
   */
  onDidChange(callback: () => void): Promise<void>;
}

import type { PaneProvider, PaneProviderModule } from '#bifrost/contracts/PaneTypes';

type PaneProviderMap = { [id: string]: PaneProvider };

/**
 * Holds information about registered pane providers.
 */
export class PaneProviderManager {
  private paneProviderMap: PaneProviderMap = {};

  /**
   * Internal: Registers the given `paneProvider` with the given `id`.
   */
  register(id: string, module: PaneProviderModule): void {
    if (this.paneProviderMap[id] != null) {
      throw new Error(`There is already a renderer registered with this key: ${id}`);
    }

    this.paneProviderMap[id] = module.paneProvider;
  }

  /**
   * Internal: Removes the pane provider with the given `id`.
   */
  unregister(id: string): void {
    delete this.paneProviderMap[id];
  }

  /**
   * Internal: Returns the paneProvider for the given `id`.
   */
  getById(id: string): PaneProvider {
    const paneProvider = this.paneProviderMap[id];

    if (paneProvider == null) {
      throw new Error(`Could not find a pane provider with this key: ${id}`);
    }

    return paneProvider;
  }
}

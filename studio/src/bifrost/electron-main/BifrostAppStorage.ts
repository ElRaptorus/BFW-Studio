import { JsonFileStorage } from './JsonFileStorage';

/**
 * `BifrostAppStorage` is used to store some information for Bifrost's electron app that is managed by the main thread
 * (e.g. information related to window management).
 *
 * Please note that Bifrost stores most of its information "in" the renderer thread through `LocalStorageItem` instances.
 */
export default class BifrostAppStorage {
  private storageKey: string;
  private storage: any;

  constructor(storageFilename: string, storageKey: string) {
    this.storageKey = storageKey;
    this.storage = new JsonFileStorage(storageFilename);
  }

  clear(): void {
    this.storage.removeItem(this.storageKey);
  }

  load(): any {
    const data = this.storage.getItem(this.storageKey);

    return data;
  }

  save(data: any): void {
    this.storage.setItem(this.storageKey, data);
  }
}

import * as jsonComment from 'comment-json';

import type { BifrostLocalStorage } from '../contracts/BifrostTypes';

/**
 * Represents a repository for a single item in a Storage, like `window.localStorage`.
 *
 *    const item = new LocalStorageItem(window.storage, 'my-item')
 *    item.save({foo: 'bar'})
 *    item.load()
 *    // => {foo: 'bar'}
 *    item.clear()
 *    item.load()
 *    // => undefined
 *
 * By exposing methods to `save`, `load` or `clear` the item, the business logic in our program does not need to know
 * under which name the item is stored (or in which storage).
 */
export class LocalStorageItem {
  private localStorage: BifrostLocalStorage;
  private name: string;

  constructor(localStorage: BifrostLocalStorage, name: string) {
    this.localStorage = localStorage;
    this.name = name;
  }

  clear(): void {
    this.localStorage.removeItem(this.name);
  }

  load(): any {
    const dataString = this.localStorage.getItem(this.name);

    if (dataString == null) {
      return null;
    }

    const data = this.tryParse(dataString);

    return data;
  }

  save(serializableData: any): void {
    const data = jsonComment.stringify(serializableData, null, 2);

    this.localStorage.setItem(this.name, data);
  }

  private tryParse(value: string): any {
    try {
      const parsedValue = jsonComment.parse(value);
      return parsedValue;
    } catch (error) {
      console.warn(`Failed to parse "${value}" from LocalStorageItem "${this.name}"`, error);
      return null;
    }
  }
}

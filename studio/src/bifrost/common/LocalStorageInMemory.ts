export class LocalStorageInMemory {
  private store: { [key: string]: string } = {};

  getItem(key: string): string | null {
    return this.store[key];
  }

  removeItem(key: string): void {
    delete this.store[key];
  }

  setItem(key: string, value: string): void {
    this.store[key] = value;
  }
}

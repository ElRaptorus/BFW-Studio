import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'fs';
import { dirname } from 'path';

export class JsonFileStorage {
  private filename: string;
  private data: any;
  private deleted = false;

  constructor(filename: string) {
    this.filename = filename;
    this.data = this.readFromDisk() || {};
  }

  removeItem(key: string): void {
    delete this.data[key];
    this.writeToDisk();
  }

  getItem(key: string): any {
    return this.data[key];
  }

  setItem(key: string, value: any): void {
    this.data[key] = value;
    this.writeToDisk();
  }

  delete(): void {
    if (existsSync(this.filename)) {
      this.data = {};
      rmSync(this.filename);
      this.deleted = true;
    }
  }

  private readFromDisk(): any {
    if (!existsSync(this.filename)) {
      return null;
    }
    const contents = readFileSync(this.filename, 'utf-8');

    if (contents.trim() === '') {
      return null;
    }

    return this.tryToParseJson(contents);
  }

  private tryToParseJson(contents: string): any {
    try {
      return JSON.parse(contents);
    } catch (e) {
      console.error(`Error while loading ${this.filename}`, e);
      return null;
    }
  }

  private writeToDisk(): void {
    if (this.deleted) {
      return;
    }
    if (!existsSync(this.filename)) {
      mkdirSync(dirname(this.filename), { recursive: true });
    }
    writeFileSync(this.filename, JSON.stringify(this.data, null, 2), 'utf-8');
  }
}

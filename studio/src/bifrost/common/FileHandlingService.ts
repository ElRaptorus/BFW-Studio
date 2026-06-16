import { assertNotNull } from '@evil/bifrost_fw_sdk';
import type { FileEventType, WatcherDisposable } from '@evil/bifrost_fw_sdk/types/common';
import type { Project } from '@evil/bifrost_fw_sdk/types/contracts';

import type { FileOrDirectory } from '../contracts/FileSystemTypes';

/**
 * The about protocol is used for "internal" views, like "about:start"
 */
export const ABOUT_PROTOCOL = 'about';

export const FILE_PROTOCOL = 'file';
export const HTTP_PROTOCOL = 'http';
export const HTTPS_PROTOCOL = 'https';

/**
 * The buffer protocol is used for all unsaved views
 */
export const BUFFER_PROTOCOL = 'buffer';
/**
 * The mocr protocol is used for mocked views during development of Bifrost
 */
export const MOCK_PROTOCOL = 'mock';

const ILLEGAL_FILENAME_CHARACTERS = /[:^`]/;

export type FileWatcherCallback = (eventType: FileEventType, filePath: string, stats?: unknown) => void | Promise<void>;

/**
 * Provides methods for dealing with document based I/O.
 *
 * Platform-dependent methods are abstract and must be implemented by subclasses
 * (e.g. `FileHandlingServiceElectron`). Pure URI-logic utilities are concrete.
 */
export abstract class FileHandlingService {
  isInvalidFilename(filename: string): boolean {
    return ILLEGAL_FILENAME_CHARACTERS.test(filename);
  }

  isValidFilename(filename: string): boolean {
    return !this.isInvalidFilename(filename);
  }

  isHttpUri(uri: string): boolean {
    return this.isHttpProtocol(uri);
  }

  abstract isDirectory(uri: string): Promise<boolean>;

  abstract listDirectory(uri: string): Promise<string[]>;

  abstract traverseDirectory(uri: string, callbackFn: (item: FileOrDirectory) => Promise<any>): Promise<any[]>;

  abstract traverseProject(project: Project, callbackFn: (item: FileOrDirectory) => Promise<any>): Promise<any[]>;

  abstract load(uri: string): Promise<string>;

  abstract save(uri: string, content: string | Buffer): Promise<boolean>;

  canSave(uri: string): boolean {
    const protocol = this.getProtocol(uri);
    return protocol === FILE_PROTOCOL || protocol === BUFFER_PROTOCOL;
  }

  canSaveImmediately(uri: string): boolean {
    return this.isFileProtocol(uri);
  }

  getFilename(uri: string): string {
    if (this.isFileProtocol(uri)) {
      const match = uri.match(/[/\\]([^/\\]+)$/);
      if (match != null) {
        return match[1];
      }
    }

    throw Error(`TODO: implement getFilename() for ${uri}`);
  }

  getUriForFilename(filename: string): string {
    return `file://${filename}`;
  }

  getLocalFilenameForUri(uri: string, substituteHomeDir: boolean = false): string {
    if (this.isFileProtocol(uri)) {
      const localFilename = decodeURI(uri).replace(/^file:\/\//, '');
      const home = process && process.env && process.env.HOME;

      if (substituteHomeDir && home && localFilename.indexOf(home) === 0) {
        return this.getHomeDirSubstitute() + localFilename.slice(home.length, localFilename.length);
      }

      return localFilename;
    }

    throw new Error(`URI is not a local filename: ${uri}`);
  }

  async getLocalDirectory(uri: string, substituteHomeDir: boolean = false): Promise<string> {
    const isDir = await this.isDirectory(uri);
    const rawDirectory = isDir ? this.getLocalFilenameForUri(uri) : this.getContainingDirectory(uri);
    const home = process && process.env && process.env.HOME;

    if (substituteHomeDir && home && rawDirectory.indexOf(home) === 0) {
      return this.getHomeDirSubstitute() + rawDirectory.slice(home.length, rawDirectory.length);
    }

    return rawDirectory;
  }

  async getLocalDirectoryOrNull(uri: string, substituteHomeDir: boolean = false): Promise<string | null> {
    const isDir = await this.isDirectory(uri);
    const rawDirectory = isDir ? this.getLocalFilenameForUri(uri) : this.getContainingDirectoryOrNull(uri);
    const home = process && process.env && process.env.HOME;

    if (!rawDirectory) {
      return null;
    }

    if (substituteHomeDir && home && rawDirectory.startsWith(home)) {
      return this.getHomeDirSubstitute() + rawDirectory.slice(home.length);
    }

    return rawDirectory;
  }

  getHomeDirSubstitute(): string {
    return '~'; // TODO: do not use tilde ("~") on windows
  }

  abstract getLocalBasename(uri: string, removeExtension?: boolean): string;

  abstract getFileExtension(uri: string): string;

  isLocalFilename(uri: string): boolean {
    return this.isFileProtocol(uri);
  }

  abstract joinPaths(leftPart: string, rightPart: string): string;

  getContainingDirectoryOrNull(uri: string): string | null {
    if (this.isFileProtocol(uri)) {
      const match = uri.match(/^file:\/\/(.+)[/\\]([^/\\]+)$/);
      if (match != null) {
        return match[1];
      }
    }

    return null;
  }

  getContainingDirectory(uri: string): string {
    if (this.isFileProtocol(uri)) {
      const match = uri.match(/^file:\/\/(.+)[/\\]([^/\\]+)$/);
      if (match != null) {
        return match[1];
      }

      throw new Error(`Failed to determine containing directory for file URI : ${uri}`);
    }

    throw Error(`TODO: Implement getContainingDirectory for URI: ${uri}`);
  }

  protected getProtocol(uri: string): string | null {
    assertNotNull(uri, 'uri');

    const matches = uri.match(/^([^:]+):(.+)/);
    return matches == null ? null : matches[1];
  }

  protected isBufferProtocol(uri: string): boolean {
    return this.getProtocol(uri) === BUFFER_PROTOCOL;
  }

  protected isFileProtocol(uri: string): boolean {
    return this.getProtocol(uri) === FILE_PROTOCOL;
  }

  protected isHttpProtocol(uri: string): boolean {
    return this.getProtocol(uri) === HTTP_PROTOCOL || this.getProtocol(uri) === HTTPS_PROTOCOL;
  }

  abstract watchDirectory(
    directoryUri: string,
    callbackFn: FileWatcherCallback,
    ignoredPatterns?: string[],
  ): WatcherDisposable;

  abstract watchFile(fileUri: string, callbackFn: FileWatcherCallback): WatcherDisposable;

  abstract createDirectory(directoryUri: string): Promise<boolean>;

  abstract deleteFilesAndDirectories(uris: string[]): Promise<boolean>;

  abstract copyFileOrDirectory(sourceUri: string, destinationUri: string): Promise<boolean>;

  abstract renameFileOrDirectory(currentUri: string, newUri: string): Promise<boolean>;

  abstract doesFileOrDirectoryExist(localFilename: string): Promise<boolean>;

  abstract getAllFileUrisInDirectoryTree(rootFolderUri: string): Promise<string[]>;
}

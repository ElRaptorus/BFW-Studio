import * as chokidar from 'chokidar';
import type { EventName } from 'chokidar/handler.js';
import { ipcRenderer } from 'electron';
import type * as fs from 'fs';
import { Minimatch } from 'minimatch';
import * as path from 'path';

import { assertNotNull } from '@evil/bifrost_fw_sdk';
import type { WatcherDisposable } from '@evil/bifrost_fw_sdk/types/common';
import type { Project } from '@evil/bifrost_fw_sdk/types/contracts';

import { FileHandlingService } from '../common/FileHandlingService';
import { FilePatternMatcher, computeRelativeUri } from '../common/FilePatternMatcher';
import type { FileOrDirectory } from '../contracts/FileSystemTypes';
import {
  IPC_INVOKE_COPY_FILE_OR_DIRECTORY,
  IPC_INVOKE_CREATE_DIR,
  IPC_INVOKE_EXISTS,
  IPC_INVOKE_IS_DIRECTORY,
  IPC_INVOKE_READ_DIR,
  IPC_INVOKE_READ_FILE,
  IPC_INVOKE_RENAME_FILE_OR_DIRECTORY,
  IPC_INVOKE_TRASH_ITEM,
  IPC_INVOKE_TRAVERSE_DIRECTORY,
  IPC_INVOKE_WRITE_FILE,
} from '../contracts/IpcEvents';

type NoContent = null;
const NO_CONTENT: NoContent = null;

type TraversalEntry = {
  name: string;
  relativePath: string;
  isDirectory: boolean;
  isFile: boolean;
};

export default class FileHandlingServiceElectron extends FileHandlingService {
  private static readonly TRAVERSAL_CACHE_TTL_MS = 500;
  private traversalCache: { key: string; result: TraversalEntry[]; timestamp: number } | null = null;

  getUriForFilename(filename: string): string {
    return super.getUriForFilename(path.resolve(filename));
  }

  async isDirectory(uri: string): Promise<boolean> {
    if (!this.isFileProtocol(uri)) {
      throw new Error(`isDirectory is only implemented for the file: protocol, got: ${uri}`);
    }

    const filename = this.getLocalFilenameForUri(uri);

    try {
      return await ipcRenderer.invoke(IPC_INVOKE_IS_DIRECTORY, filename);
    } catch {
      return false;
    }
  }

  async listDirectory(uri: string): Promise<string[]> {
    if (!this.isFileProtocol(uri)) {
      throw new Error(`listDirectory is only implemented for the file: protocol, got: ${uri}`);
    }

    const localDirectory = this.getLocalFilenameForUri(uri);

    const exists = await this.doesFileOrDirectoryExist(localDirectory);
    if (!exists || !(await this.isDirectory(uri))) {
      return [];
    }

    const entries: { name: string }[] = await ipcRenderer.invoke(IPC_INVOKE_READ_DIR, localDirectory, {
      withFileTypes: true,
    });

    return entries.map((entry) => this.getUriForFilename(path.join(localDirectory, entry.name))).sort();
  }

  async traverseDirectory(uri: string, callbackFn: (item: FileOrDirectory) => Promise<any>): Promise<any[]> {
    const traversalResult = await this.performTraverseDirectory(uri, callbackFn);

    return traversalResult;
  }

  private async performTraverseDirectory(
    uri: string,
    callbackFn: (item: FileOrDirectory) => Promise<any>,
    traversalResult: any[] = [],
    excludePatterns: string[] = [],
  ): Promise<any[]> {
    if (!this.isFileProtocol(uri)) {
      throw new Error(`traverseDirectory is only implemented for the protocol 'file:', got: '${uri}'`);
    }

    const rootDir = this.getLocalFilenameForUri(uri);

    let flatEntries: TraversalEntry[];
    const cacheKey = `${rootDir}|${excludePatterns.join(',')}`;
    const now = Date.now();

    if (
      this.traversalCache != null &&
      this.traversalCache.key === cacheKey &&
      now - this.traversalCache.timestamp < FileHandlingServiceElectron.TRAVERSAL_CACHE_TTL_MS
    ) {
      flatEntries = this.traversalCache.result;
    } else {
      try {
        flatEntries = await ipcRenderer.invoke(IPC_INVOKE_TRAVERSE_DIRECTORY, rootDir, excludePatterns);
      } catch {
        throw new Error(`traverseDirectory called on non-existing or inaccessible directory: '${uri}'`);
      }
      this.traversalCache = { key: cacheKey, result: flatEntries, timestamp: now };
    }

    const childrenByParent = new Map<string, TraversalEntry[]>();
    for (const entry of flatEntries) {
      const parentKey = path.dirname(entry.relativePath);
      const normalizedParentKey = parentKey === '.' ? '' : parentKey;

      if (!childrenByParent.has(normalizedParentKey)) {
        childrenByParent.set(normalizedParentKey, []);
      }
      childrenByParent.get(normalizedParentKey)!.push(entry);
    }

    const processLevel = async (parentRelativePath: string, resultArray: any[]): Promise<void> => {
      const children = childrenByParent.get(parentRelativePath) || [];

      const directories = children
        .filter((entry) => entry.isDirectory)
        .sort((left, right) => left.name.localeCompare(right.name));

      const files = children.filter((entry) => entry.isFile).sort((left, right) => left.name.localeCompare(right.name));

      for (const entry of [...directories, ...files]) {
        const absoluteFilename = path.resolve(rootDir, entry.relativePath);
        const base = { file: entry.name, uri: this.getUriForFilename(absoluteFilename) };

        if (entry.isDirectory) {
          const dirEntry: FileOrDirectory = { ...base, type: 'directory', entries: [] };
          const transformed = await callbackFn(dirEntry);

          if (transformed != null) {
            resultArray.push(transformed);
            if (transformed.entries != null) {
              await processLevel(entry.relativePath, transformed.entries);
            }
          }
        } else {
          const fileEntry: FileOrDirectory = { ...base, type: 'file' };
          const transformed = await callbackFn(fileEntry);

          if (transformed != null) {
            resultArray.push(transformed);
          }
        }
      }
    };

    await processLevel('', traversalResult);

    return traversalResult;
  }

  async traverseProject(project: Project, callbackFn: (item: FileOrDirectory) => Promise<any>): Promise<any[]> {
    assertNotNull(project, 'project');

    const matcher = new FilePatternMatcher(project.files.included, project.files.excluded);

    const traversalResult = await this.performTraverseDirectory(
      project.baseUri,
      async (fileOrDirectory) => {
        const relativeUri = computeRelativeUri(fileOrDirectory.uri, project.baseUri);

        if (matcher.isVisible(relativeUri, fileOrDirectory.type)) {
          return callbackFn(fileOrDirectory);
        }

        return null;
      },
      [],
      matcher.getExcludePatterns(),
    );

    return traversalResult;
  }

  async load(uri: string): Promise<string> {
    const content = await this.loadFileContent(uri);
    if (content == null) {
      throw new Error(`Could not load URI: ${uri}`);
    }

    return content;
  }

  private async loadFileContent(uri: string): Promise<string | NoContent> {
    if (this.isFileProtocol(uri)) {
      const localPath = this.getLocalFilenameForUri(uri);

      try {
        return ipcRenderer.invoke(IPC_INVOKE_READ_FILE, localPath, { encoding: 'utf-8' });
      } catch (error) {
        throw new Error(`Error during loadFileContent: ${error}`);
      }
    }

    if (this.isBufferProtocol(uri)) {
      return Promise.resolve(NO_CONTENT);
    }

    throw new Error(`Could not load URI: ${uri}`);
  }

  watchDirectory(
    directoryUri: string,
    callbackFn: (eventType: EventName, filePath: string, stats?: fs.Stats) => void | Promise<void>,
    ignoredPatterns?: string[],
  ): WatcherDisposable {
    const directory = this.getLocalFilenameForUri(directoryUri);
    const ignored = this.buildChokidarIgnoreFilter(directory, ignoredPatterns);

    const watcher = chokidar
      .watch(directory, { ignoreInitial: true, ignored } as chokidar.ChokidarOptions)
      .on('all', (eventType: EventName, filePath: string, stats?: fs.Stats) => callbackFn(eventType, filePath, stats))
      .on('error', (error) => console.warn('File watcher error:', error));

    const watcherDisposable = {
      dispose: () => watcher.close(),
    };

    return watcherDisposable;
  }

  watchFile(
    fileUri: string,
    callbackFn: (eventType: EventName, filePath: string, stats?: fs.Stats) => void | Promise<void>,
  ): WatcherDisposable {
    const filename = this.getLocalFilenameForUri(fileUri);

    const watcher = chokidar
      .watch(filename, { ignoreInitial: true } as chokidar.ChokidarOptions)
      .on('all', (eventType: EventName, filePath: string, stats?: fs.Stats) => callbackFn(eventType, filePath, stats));

    const watcherDisposable = {
      dispose: () => watcher.close(),
    };

    return watcherDisposable;
  }

  async save(uri: string, content: string | Buffer): Promise<boolean> {
    if (content == null) {
      throw new Error(`Attempted to null content to URI: ${uri}`);
    }

    const localFilename = this.getLocalFilenameForUri(uri);

    await ipcRenderer.invoke(IPC_INVOKE_WRITE_FILE, localFilename, content, 'utf-8');
    return true;
  }

  async createDirectory(directoryUri: string): Promise<boolean> {
    const directory = this.getLocalFilenameForUri(directoryUri);

    await ipcRenderer.invoke(IPC_INVOKE_CREATE_DIR, directory);
    return true;
  }

  async deleteFilesAndDirectories(uris: string[]): Promise<boolean> {
    const notDeleted: string[] = [];

    for (const uri of uris) {
      const localPath = this.getLocalFilenameForUri(uri);
      const exists = await this.doesFileOrDirectoryExist(localPath);
      if (exists) {
        try {
          await ipcRenderer.invoke(IPC_INVOKE_TRASH_ITEM, localPath);
        } catch (error) {
          console.warn(error);
          notDeleted.push(uri);
        }
      }
    }

    if (notDeleted.length > 0) {
      throw new Error(`The following files could not be deleted:\n${notDeleted.join('\n')}`);
    }

    return true;
  }

  async copyFileOrDirectory(sourceUri: string, destinationUri: string): Promise<boolean> {
    const sourcePath = this.getLocalFilenameForUri(sourceUri);
    const destinationPath = this.getLocalFilenameForUri(destinationUri);

    await ipcRenderer.invoke(IPC_INVOKE_COPY_FILE_OR_DIRECTORY, sourcePath, destinationPath);
    return true;
  }

  async renameFileOrDirectory(currentUri: string, newUri: string): Promise<boolean> {
    const currentName = this.getLocalFilenameForUri(currentUri);
    const newName = this.getLocalFilenameForUri(newUri);

    await ipcRenderer.invoke(IPC_INVOKE_RENAME_FILE_OR_DIRECTORY, currentName, newName);
    return true;
  }

  async doesFileOrDirectoryExist(localFilename: string): Promise<boolean> {
    const exists = await ipcRenderer.invoke(IPC_INVOKE_EXISTS, localFilename);
    return exists;
  }

  joinPaths(leftPart: string, rightPart: string): string {
    return path.join(leftPart, rightPart);
  }

  getLocalBasename(uri: string, removeExtension: boolean = false): string {
    const localPath = this.getLocalFilenameForUri(uri);

    if (removeExtension) {
      const ext = this.getFileExtension(uri);
      if (ext) {
        return path.basename(localPath, ext);
      }
    }

    return path.basename(localPath);
  }

  getFileExtension(uri: string): string {
    const localPath = this.getLocalFilenameForUri(uri);

    return path.extname(localPath);
  }

  async getAllFileUrisInDirectoryTree(rootFolderUri: string): Promise<string[]> {
    const fileUris: string[] = [];
    await this.traverseDirectory(rootFolderUri, async (item) => {
      if (item.type === 'file') {
        fileUris.push(item.uri);
      }

      return item;
    });

    return fileUris;
  }

  private buildChokidarIgnoreFilter(rootDir: string, patterns?: string[]): ((filePath: string) => boolean) | undefined {
    if (patterns == null || patterns.length === 0) {
      return undefined;
    }

    const matchers = patterns.map((pattern) => new Minimatch(pattern));

    return (filePath: string): boolean => {
      const relative = path.relative(rootDir, filePath);
      if (relative === '') {
        return false;
      }
      const segments = relative.split(path.sep);
      return matchers.some((matcher) => matcher.match(relative) || segments.some((segment) => matcher.match(segment)));
    };
  }
}

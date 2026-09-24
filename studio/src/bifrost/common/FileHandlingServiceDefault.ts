import type { WatcherDisposable } from '#bifrost/common/FileHandlingService';
import type { Project } from '#bifrost/contracts/SolutionTypes';

import type { FileOrDirectory } from '../contracts/FileSystemTypes';
import type { FileWatcherCallback } from './FileHandlingService';
import { FileHandlingService } from './FileHandlingService';

/**
 * Default stub implementation of `FileHandlingService`.
 *
 * Used in non-electron builds (webapp, embedded).
 */
export class FileHandlingServiceDefault extends FileHandlingService {
  async isDirectory(uri: string): Promise<boolean> {
    throw new Error(`isDirectory not implemented for: ${uri}`);
  }

  async listDirectory(uri: string): Promise<string[]> {
    throw new Error(`listDirectory not implemented for: ${uri}`);
  }

  async traverseDirectory(uri: string, _callbackFn: (item: FileOrDirectory) => Promise<any>): Promise<any[]> {
    throw new Error(`traverseDirectory not implemented for: ${uri}`);
  }

  async traverseProject(project: Project, _callbackFn: (item: FileOrDirectory) => Promise<any>): Promise<any[]> {
    throw new Error(`traverseProject not implemented for project: ${project.name}`);
  }

  async load(uri: string): Promise<string> {
    if (this.isHttpUri(uri)) {
      const response = await fetch(uri);

      if (response.status !== 200) {
        throw new Error(`load: ${uri}\n\nResponse from server:\n\n${response.statusText}`);
      }

      return response.text();
    }

    throw new Error(`load not implemented for: ${uri}`);
  }

  async save(uri: string, _content: string | Buffer): Promise<boolean> {
    throw new Error(`save not implemented for: ${uri}`);
  }

  getLocalBasename(uri: string, _removeExtension: boolean = false): string {
    throw new Error(`getLocalBasename not implemented for: ${uri}`);
  }

  getFileExtension(uri: string): string {
    throw new Error(`getFileExtension not implemented for: ${uri}`);
  }

  joinPaths(_leftPart: string, _rightPart: string): string {
    throw new Error('joinPaths not implemented');
  }

  watchDirectory(
    directoryUri: string,
    _callbackFn: FileWatcherCallback,
    _ignoredPatterns?: string[],
  ): WatcherDisposable {
    throw new Error(`watchDirectory not implemented for: ${directoryUri}`);
  }

  watchFile(fileUri: string, _callbackFn: FileWatcherCallback, _options?: { depth?: number }): WatcherDisposable {
    throw new Error(`watchFile not implemented for: ${fileUri}`);
  }

  async createDirectory(directoryUri: string): Promise<boolean> {
    throw new Error(`createDirectory not implemented for: ${directoryUri}`);
  }

  async deleteFilesAndDirectories(_uris: string[]): Promise<boolean> {
    throw new Error('deleteFilesAndDirectories not implemented');
  }

  async copyFileOrDirectory(sourceUri: string, _destinationUri: string): Promise<boolean> {
    throw new Error(`copyFileOrDirectory not implemented for: ${sourceUri}`);
  }

  async renameFileOrDirectory(currentUri: string, _newUri: string): Promise<boolean> {
    throw new Error(`renameFileOrDirectory not implemented for: ${currentUri}`);
  }

  async doesFileOrDirectoryExist(localFilename: string): Promise<boolean> {
    throw new Error(`doesFileOrDirectoryExist not implemented for: ${localFilename}`);
  }

  async getAllFileUrisInDirectoryTree(rootFolderUri: string): Promise<string[]> {
    throw new Error(`getAllFileUrisInDirectoryTree not implemented for: ${rootFolderUri}`);
  }
}

/// <reference types="node" />
import type * as fs from 'fs';

import type { FileOrDirectory, Project } from '../contracts';

export declare type WatcherDisposable = {
  dispose: () => void;
};
export type FileEventType = 'all' | 'ready' | 'add' | 'change' | 'addDir' | 'unlink' | 'unlinkDir' | 'raw' | 'error';

/**
 * The about protocol is used for "internal" views, like "about:start"
 */
export declare const ABOUT_PROTOCOL = 'about';
export declare const FILE_PROTOCOL = 'file';
export declare const HTTP_PROTOCOL = 'http';
export declare const HTTPS_PROTOCOL = 'https';
/**
 * The buffer protocol is used for all unsaved views
 */
export declare const BUFFER_PROTOCOL = 'buffer';
/**
 * The mocr protocol is used for mocked views during development of Studio
 */
export declare const MOCK_PROTOCOL = 'mock';
/**
 * Provides methods for dealing with document based I/O.
 */
export declare class FileHandlingService {
  /**
   * Returns `true` if the given `filename` contains illegal characters.
   */
  isInvalidFilename(filename: string): boolean;
  isValidFilename(filename: string): boolean;
  /**
   * Returns `true` if the given `uri` is a directory.
   */
  isDirectory(uri: string): Promise<boolean>;
  /**
   * Lists the contents of a directory.
   */
  listDirectory(uri: string): Promise<string[]>;
  traverseDirectory(uri: string, callbackFn: (item: FileOrDirectory) => Promise<any>): Promise<any[]>;
  traverseProject(project: Project, callbackFn: (item: FileOrDirectory) => Promise<any>): Promise<any[]>;
  /**
   * Loads content from the given `uri`.
   */
  load(uri: string): Promise<string>;
  /**
   * Saves the given `content` under the given `uri`.
   */
  save(uri: string, content: string | Buffer): Promise<boolean>;
  /**
   * Returns `true` if the given `uri` can be written to.
   */
  canSave(uri: string): boolean;
  /**
   * Returns `true` if the given `uri` can be written to without any user interaction like choosing a filename.
   */
  canSaveImmediately(uri: string): boolean;
  /**
   * Returns a local file name for the given `uri`.
   */
  getFilename(uri: string): string;
  /**
   * Returns a URI for a local `filename`.
   */
  getUriForFilename(filename: string): string;
  /**
   * Returns a local filename for the given `uri`.
   */
  getLocalFilenameForUri(uri: string, substituteHomeDir?: boolean): string;
  getLocalDirectory(uri: string, substituteHomeDir?: boolean): Promise<string>;
  getHomeDirSubstitute(): string;
  getLocalBasename(uri: string, removeExtension?: boolean): string;
  getFileExtension(uri: string): string;
  /**
   * Returns `true` if the given `uri` is a local filename.
   */
  isLocalFilename(uri: string): boolean;
  /**
   * Returns the joined path.
   */
  joinPaths(leftPart: string, rightPart: string): string;
  getContainingDirectory(uri: string): string;
  watchDirectory(
    directoryUri: string,
    callbackFn: (eventType: FileEventType, filePath: string) => void | Promise<void>,
    ignoredPatterns?: string[],
  ): WatcherDisposable;
  watchFile(
    fileUri: string,
    callbackFn: (eventType: FileEventType, filePath: string) => void | Promise<void>,
    stats?: fs.Stats,
  ): WatcherDisposable;
  createDirectory(directoryUri: string): Promise<boolean>;
  deleteFilesAndDirectories(uris: string[]): Promise<boolean>;
  copyFileOrDirectory(sourceUri: string, destinationUri: string): Promise<boolean>;
  renameFileOrDirectory(currentUri: string, newUri: string): Promise<boolean>;
  doesFileOrDirectoryExist(localFilename: string): Promise<boolean>;
  getAllFileUrisInDirectoryTree(rootFolderUri: string): Promise<string[]>;
}

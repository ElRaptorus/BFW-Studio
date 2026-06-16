import type { FileChangeEvent, FileStat, ProjectFolder } from './types';

/**
 * Scoped file system and workspace access for plugins.
 *
 * All file operations are restricted to:
 * - The current solution's project folders
 * - The plugin's own storage directory (`api.env.storagePath`)
 *
 * Paths outside these scopes are rejected with an error.
 * Plugins work with `file://` URIs matching the Studio's internal convention.
 */
export interface WorkspaceApi {
  /** Read a text file (UTF-8). */
  readFile(uri: string): Promise<string>;

  /** Read a binary file. Returns a `Uint8Array`. */
  readBinaryFile(uri: string): Promise<Uint8Array>;

  /** Write a text file (UTF-8). Creates parent directories if needed. */
  writeFile(uri: string, content: string): Promise<void>;

  /** Write a binary file. Accepts a `Uint8Array`. Creates parent directories if needed. */
  writeBinaryFile(uri: string, content: Uint8Array): Promise<void>;

  /** List entries in a directory. Returns file and directory entries with their URIs. */
  listDirectory(uri: string): Promise<{ name: string; uri: string; type: 'file' | 'directory' }[]>;

  /** Get file or directory metadata. */
  stat(uri: string): Promise<FileStat>;

  /** Create a directory (recursive). */
  createDirectory(uri: string): Promise<void>;

  /** Delete a file or directory. */
  deleteFile(uri: string): Promise<void>;

  /**
   * Watch a file or directory for changes.
   *
   * The callback receives coalesced change events (100ms debounce).
   * Returns a disposer to stop watching.
   */
  onDidChangeFile(uri: string, callback: (event: FileChangeEvent) => void): Promise<{ dispose: () => void }>;

  /**
   * Subscribe to solution structure changes (projects added, removed, or reloaded).
   *
   * The callback receives no arguments — call `getProjectFolders()` to read the new state.
   */
  onDidChangeSolution(callback: () => void): Promise<{ dispose: () => void }>;

  /** Get the current solution's project folders. */
  getProjectFolders(): Promise<ProjectFolder[]>;
}

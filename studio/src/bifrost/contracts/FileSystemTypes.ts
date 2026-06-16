export type FileEntry = {
  file: string;
  uri: string;
  type: 'file';
};

export type DirectoryEntry = {
  file: string;
  uri: string;
  type: 'directory';
  entries: FileOrDirectory[];
};

export type FileOrDirectory = FileEntry | DirectoryEntry;

export interface ILoadable {
  load(uri: string): Promise<string>;
  getLocalFilenameForUri(uri: string): string;
}

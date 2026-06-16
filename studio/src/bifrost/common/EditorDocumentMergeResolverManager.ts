type MergeResolverMap = { [id: string]: any };

/**
 * Holds information about the various merge resolver components used to visualize
 * merge conflicts for specific document types.
 *
 * Unlike the inspector manager, a missing key returns `null` (the expected fallback case).
 */
export class EditorDocumentMergeResolverManager {
  private resolverMap: MergeResolverMap = {};

  register(id: string, mergeResolver: any): void {
    if (this.resolverMap[id] != null) {
      throw new Error(`A merge resolver with the given id already exists: ${id}`);
    }
    this.resolverMap[id] = mergeResolver;
  }

  unregister(id: string): void {
    delete this.resolverMap[id];
  }

  getByKey(key: string): any | null {
    return this.resolverMap[key] ?? null;
  }
}

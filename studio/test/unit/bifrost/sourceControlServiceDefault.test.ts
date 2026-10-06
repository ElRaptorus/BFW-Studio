import { describe, expect, it } from 'vitest';

import { SourceControlServiceDefault } from '../../../src/bifrost/common/SourceControlServiceDefault';

describe('SourceControlServiceDefault', () => {
  const service = new SourceControlServiceDefault();

  it('reports source control as unavailable', async () => {
    await expect(service.isAvailable()).resolves.toBe(false);
  });

  it('rejects operations with a message the user can read', async () => {
    await expect(service.getRepositoryState()).rejects.toThrow(
      'Source control is not available in this version of the Studio.',
    );
    await expect(service.getFileContentAtRevision()).rejects.toThrow('not available');
  });

  it('resolves pull with an unsuccessful result instead of rejecting', async () => {
    await expect(service.pull()).resolves.toEqual({
      success: false,
      error: 'Source control is not available in this version of the Studio.',
      recoverable: null,
    });
  });

  it('returns a callable unsubscribe for clone progress', () => {
    expect(() => service.onCloneProgress()()).not.toThrow();
  });
});

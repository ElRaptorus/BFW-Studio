import { describe, expect, it, vi } from 'vitest';

import { getUrlForOpenInNewTab } from '../../../src/bifrost/common/OpenInNewTabUrl';
import TextDiffDocumentModel from '../../../src/modules/git-cruiser/textDiff/TextDiffDocumentModel';

const fileUri = 'file:///work/repository/config/a.json';

function createUri(data: Record<string, string>): string {
  return getUrlForOpenInNewTab('git.text-diff', fileUri, 'text-diff', {
    repositoryRoot: '/work/repository',
    path: 'config/a.json',
    beforeLabel: 'Before',
    afterLabel: 'After',
    ...data,
  });
}

function createFakeBifrost(options: { workingContent?: string; fileExists?: boolean } = {}) {
  const getFileContentAtRevision = vi.fn(async (_root: string, revision: string, relativePath: string) => {
    return `${relativePath}@${revision}`;
  });
  const load = vi.fn(async () => options.workingContent ?? 'working');

  const bifrost = {
    sourceControl: { getFileContentAtRevision },
    files: {
      load,
      getLocalFilenameForUri: (uri: string) => uri.replace('file://', ''),
      doesFileOrDirectoryExist: async () => options.fileExists ?? true,
    },
  };

  return { bifrost: bifrost as any, getFileContentAtRevision, load };
}

describe('TextDiffDocumentModel', () => {
  it('reads a committed side from git and the working side from disk', async () => {
    const { bifrost, getFileContentAtRevision, load } = createFakeBifrost({ workingContent: 'on disk' });

    const model = await TextDiffDocumentModel.create(
      createUri({ beforeRef: 'HEAD', afterRef: 'WORKING' }),
      null,
      null,
      null as any,
      bifrost,
    );

    expect(getFileContentAtRevision).toHaveBeenCalledWith('/work/repository', 'HEAD', 'config/a.json');
    expect(load).toHaveBeenCalledWith(fileUri);
    expect(model.getBeforeText()).toBe('config/a.json@HEAD');
    expect(model.getAfterText()).toBe('on disk');
    expect(model.getRelativePath()).toBe('config/a.json');
    expect(model.getFileUri()).toBe(fileUri);
    expect(model.getBeforeLabel()).toBe('Before');
    expect(model.getAfterLabel()).toBe('After');
    expect(model.getFileExists()).toBe(true);
    expect(model.canCompare()).toBe(true);
  });

  it('treats a NONE side as empty without asking git, and reads a renamed file from its previous path', async () => {
    const { bifrost, getFileContentAtRevision } = createFakeBifrost({ fileExists: false });

    const addedModel = await TextDiffDocumentModel.create(
      createUri({ beforeRef: 'NONE', afterRef: 'abc1234' }),
      null,
      null,
      null as any,
      bifrost,
    );
    expect(addedModel.getBeforeText()).toBe('');
    expect(addedModel.getAfterText()).toBe('config/a.json@abc1234');
    expect(addedModel.getFileExists()).toBe(false);
    expect(getFileContentAtRevision).toHaveBeenCalledTimes(1);

    const renamedModel = await TextDiffDocumentModel.create(
      createUri({ beforeRef: 'HEAD', afterRef: 'abc1234', previousPath: 'config/old.json' }),
      null,
      null,
      null as any,
      bifrost,
    );
    expect(renamedModel.getBeforeText()).toBe('config/old.json@HEAD');
  });

  it('cannot compare a binary side', async () => {
    const { bifrost } = createFakeBifrost({ workingContent: 'PK\u0000\u0003' });

    const model = await TextDiffDocumentModel.create(
      createUri({ beforeRef: 'NONE', afterRef: 'WORKING' }),
      null,
      null,
      null as any,
      bifrost,
    );

    expect(model.canCompare()).toBe(false);
  });

  it('compares exactly two million characters and refuses one more', async () => {
    const createModel = async (workingContent: string) =>
      TextDiffDocumentModel.create(
        createUri({ beforeRef: 'NONE', afterRef: 'WORKING' }),
        null,
        null,
        null as any,
        createFakeBifrost({ workingContent }).bifrost,
      );

    expect((await createModel('a'.repeat(2 * 1024 * 1024))).canCompare()).toBe(true);
    expect((await createModel('a'.repeat(2 * 1024 * 1024 + 1))).canCompare()).toBe(false);
  });

  it('rejects when a version cannot be read', async () => {
    const { bifrost, getFileContentAtRevision } = createFakeBifrost();
    getFileContentAtRevision.mockRejectedValue(new Error('fatal: bad revision'));

    await expect(
      TextDiffDocumentModel.create(
        createUri({ beforeRef: 'deadbeef', afterRef: 'WORKING' }),
        null,
        null,
        null as any,
        bifrost,
      ),
    ).rejects.toThrow('bad revision');
  });
});

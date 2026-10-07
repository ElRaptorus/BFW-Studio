import { SolutionMediator } from '#bifrost/common/SolutionMediator';
import { describe, expect, it } from 'vitest';

const baseUri = 'file:///proj';

function createMediator(fileNames: string[]): SolutionMediator {
  const fileHandling = {
    traverseProject: async (_project: unknown, callback: (item: unknown) => Promise<unknown>) => {
      await Promise.all(fileNames.map((file) => callback({ type: 'file', uri: `${baseUri}/${file}`, file })));
    },
    getFilename: () => 'proj',
    watchDirectory: () => ({ dispose: () => undefined }),
    isLocalFilename: () => true,
  };
  return new SolutionMediator(
    fileHandling as any,
    { mark: () => undefined } as any,
    { addRecentlyOpenedSolutionItem: () => undefined } as any,
    { register: () => undefined, on: () => undefined, get: () => [] } as any,
    { on: () => undefined, traverse: () => undefined } as any,
    { load: () => undefined, save: () => undefined, clear: () => undefined } as any,
    async () => false,
  );
}

describe('SolutionMediator.listIncludedFileUris', () => {
  it('filters by pattern and inclusion, sorts by URI, and returns nothing without a solution', async () => {
    const mediator = createMediator(['z.bpmn', 'a.bpmn', 'notes.txt', 'b.dmn']);

    expect(await mediator.listIncludedFileUris(/\.bpmn$/i)).toEqual([]);

    mediator.openDirectoryAsSolution(baseUri);
    expect(await mediator.listIncludedFileUris(/\.bpmn$/i)).toEqual([`${baseUri}/a.bpmn`, `${baseUri}/z.bpmn`]);

    mediator.closeSolution();
    mediator.registerDefaultIncludedFiles(['**/*.dmn']);
    mediator.openDirectoryAsSolution(baseUri);
    expect(await mediator.listIncludedFileUris(/\.bpmn$/i)).toEqual([]);
    expect(await mediator.listIncludedFileUris(/\.dmn$/i)).toEqual([`${baseUri}/b.dmn`]);
  });
});

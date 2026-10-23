import { getLandscapeGate, getMapOpenRefusal } from '#modules/bpmn-landscape/landscapeFolder';
import { describe, expect, it } from 'vitest';

const SOLUTION_FILE = 'file:///work/app/App.bfwsln';

function createBifrost(solution: any, landscapeFolderUri: string | null = null): any {
  return {
    solution: {
      getSolution: () => solution,
      getViewFolderUri: (viewId: string) => (viewId === 'landscapes' ? landscapeFolderUri : null),
    },
    files: { getLocalFilenameForUri: (uri: string) => uri.replace(/^file:\/\//, '') },
  };
}

describe('landscape folder gate', () => {
  it('names the step that is still missing', () => {
    expect(getLandscapeGate(createBifrost(null))).toEqual({ state: 'no-solution' });
    expect(getLandscapeGate(createBifrost({ isExplicitSolution: false }))).toEqual({
      state: 'unsaved',
      isFolder: true,
    });
    expect(getLandscapeGate(createBifrost({ isExplicitSolution: true }))).toEqual({
      state: 'unsaved',
      isFolder: false,
    });
    expect(getLandscapeGate(createBifrost({ solutionFileUri: SOLUTION_FILE }))).toEqual({
      state: 'no-folder',
      solutionFileUri: SOLUTION_FILE,
    });
    expect(getLandscapeGate(createBifrost({ solutionFileUri: SOLUTION_FILE }, 'file:///work/app/landscapes'))).toEqual({
      state: 'ready',
      solutionFileUri: SOLUTION_FILE,
      folderUri: 'file:///work/app/landscapes',
    });
  });

  it('opens maps only from inside the landscape folder', () => {
    const bifrost = createBifrost({ solutionFileUri: SOLUTION_FILE }, 'file:///work/app/landscapes');

    expect(getMapOpenRefusal(bifrost, 'file:///work/app/landscapes/sales/Overview.bfwmap')).toBeNull();
    expect(getMapOpenRefusal(bifrost, 'file:///work/app/landscapes-old/Overview.bfwmap')).toBe(
      'Landscape maps open only from the landscape folder of the open solution (landscapes). Move this map there or open its solution.',
    );
  });

  it('names a landscape folder outside the solution folder by its local path', () => {
    const bifrost = createBifrost({ solutionFileUri: SOLUTION_FILE }, 'file:///shared/maps');

    expect(getMapOpenRefusal(bifrost, 'file:///work/app/Overview.bfwmap')).toContain('(/shared/maps)');
  });

  it('refuses every map without a saved solution or a landscape folder', () => {
    expect(getMapOpenRefusal(createBifrost({ isExplicitSolution: false }), 'file:///work/app/A.bfwmap')).toContain(
      'saved solution',
    );
    expect(getMapOpenRefusal(createBifrost({ solutionFileUri: SOLUTION_FILE }), 'file:///work/app/A.bfwmap')).toContain(
      'has none yet',
    );
  });
});

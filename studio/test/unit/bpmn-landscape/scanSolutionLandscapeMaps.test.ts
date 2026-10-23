import { computeRelativeUri, FilePatternMatcher } from '#bifrost/common/FilePatternMatcher';
import type { LandscapeMap } from '#modules/bpmn-landscape/LandscapeMapFile';
import { createEmptyLandscapeMap, serializeLandscapeMap } from '#modules/bpmn-landscape/LandscapeMapFile';
import { scanSolutionLandscapeMaps } from '#modules/bpmn-landscape/scanSolutionLandscapeMaps';
import { describe, expect, it } from 'vitest';

const SOLUTION_FILE = 'file:///work/App.bfwsln';
const FOLDER = 'file:///work/landscapes';

function mapWithProcesses(name: string, ...processIds: string[]): LandscapeMap {
  return {
    ...createEmptyLandscapeMap(name),
    elements: processIds.map((processId) => ({
      id: `process_${processId}`,
      type: 'process',
      parentId: null,
      x: 0,
      y: 0,
      width: 140,
      height: 60,
      style: null,
      processId,
      fileHint: `../${processId}.bpmn`,
      label: null,
      shape: 'box',
    })),
  };
}

/** `files` maps a URI to its text, or to an error that loading it throws. */
function createBifrost(
  files: Record<string, string | Error>,
  options: { folderExists?: boolean; excluded?: string[] } = {},
): any {
  return {
    settings: { get: (key: string) => (key === 'std.fileExplorer.exclude' ? (options.excluded ?? []) : undefined) },
    solution: {
      getSolution: () => ({ solutionFileUri: SOLUTION_FILE }),
      getViewFolderUri: () => FOLDER,
      getDefaultExcludedFiles: () => ['**/.git'],
    },
    files: {
      getLocalBasename: (uri: string) =>
        uri
          .split('/')
          .pop()
          ?.replace(/\.[^.]+$/, '') ?? uri,
      /** Applies the project's patterns like the Electron implementation. */
      traverseProject: async (
        project: { baseUri: string; files: { included: string[]; excluded: string[] } },
        callback: (item: unknown) => Promise<unknown>,
      ) => {
        if (options.folderExists === false) {
          throw new Error('traverseDirectory called on non-existing or inaccessible directory');
        }
        const matcher = new FilePatternMatcher(project.files.included, project.files.excluded);
        for (const uri of [...Object.keys(files), `${FOLDER}/notes.txt`]) {
          if (matcher.isVisible(computeRelativeUri(uri, project.baseUri), 'file')) {
            await callback({ type: 'file', uri, file: uri.split('/').pop() });
          }
        }
        return [];
      },
      load: async (uri: string) => {
        const content = files[uri];
        if (content instanceof Error) {
          throw content;
        }
        return content ?? '';
      },
    },
  };
}

describe('scanSolutionLandscapeMaps', () => {
  it('lists the maps of the landscape folder with the processes they show, sorted by URI', async () => {
    const bifrost = createBifrost({
      [`${FOLDER}/b.bfwmap`]: serializeLandscapeMap(mapWithProcesses('Second', 'payment')),
      [`${FOLDER}/a.bfwmap`]: serializeLandscapeMap(mapWithProcesses('First', 'order', 'payment')),
    });

    const maps = await scanSolutionLandscapeMaps(bifrost);

    expect(maps.map((map) => [map.uri, map.name, map.error])).toEqual([
      [`${FOLDER}/a.bfwmap`, 'First', null],
      [`${FOLDER}/b.bfwmap`, 'Second', null],
    ]);
    expect(maps[0].processReferences).toEqual([
      { processId: 'order', fileHint: '../order.bpmn' },
      { processId: 'payment', fileHint: '../payment.bpmn' },
    ]);
  });

  it('reports an unreadable map with its error and the file name, and an empty file as an empty map', async () => {
    const bifrost = createBifrost({
      [`${FOLDER}/broken.bfwmap`]: 'this is not xml',
      [`${FOLDER}/locked.bfwmap`]: new Error('permission denied'),
      [`${FOLDER}/empty.bfwmap`]: '',
    });

    const maps = await scanSolutionLandscapeMaps(bifrost);

    const byName = new Map(maps.map((map) => [map.name, map]));
    expect(byName.get('broken')?.error).not.toBeNull();
    expect(byName.get('locked')?.error).toBe('permission denied');
    expect(byName.get('empty')).toMatchObject({ error: null, processReferences: [] });
  });

  it('skips maps the explorer exclude patterns hide', async () => {
    const bifrost = createBifrost(
      {
        [`${FOLDER}/a.bfwmap`]: '',
        [`${FOLDER}/archive/old.bfwmap`]: '',
      },
      { excluded: ['archive/**'] },
    );

    expect((await scanSolutionLandscapeMaps(bifrost)).map((map) => map.uri)).toEqual([`${FOLDER}/a.bfwmap`]);
  });

  it('finds no maps when the landscape folder does not exist yet', async () => {
    expect(await scanSolutionLandscapeMaps(createBifrost({}, { folderExists: false }))).toEqual([]);
  });

  it('finds no maps without a ready landscape gate', async () => {
    const bifrost = createBifrost({ [`${FOLDER}/a.bfwmap`]: '' });
    bifrost.solution.getViewFolderUri = () => null;

    expect(await scanSolutionLandscapeMaps(bifrost)).toEqual([]);
  });
});

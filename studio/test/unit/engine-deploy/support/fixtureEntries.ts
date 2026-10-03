import type { FileHandlingService } from '#bifrost/common/FileHandlingService';
import type { Solution } from '#bifrost/contracts/SolutionTypes';
import { scanSolutionModels } from '#modules/solution-models/scanSolutionModels';
import type { SolutionModelEntry } from '#modules/solution-models/types';
import { promises as fileSystem } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const fixtureDirectory = path.resolve(__dirname, '../../../fixtures/test-solution-deploy');
export const fixtureBaseUri = pathToFileURL(fixtureDirectory).href;
export const fixtureUri = (file: string): string => `${fixtureBaseUri}/${file}`;

/** Scans the `test-solution-deploy` fixture the same way the Studio scans an open solution. */
export async function scanDeployFixture(): Promise<SolutionModelEntry[]> {
  const solution = {
    name: 'fixture',
    baseUri: fixtureBaseUri,
    showHiddenFiles: false,
    projects: [
      {
        type: 'project',
        id: 'p',
        name: 'fixture',
        baseUri: fixtureBaseUri,
        files: { included: ['**/*'], excluded: [] },
      },
    ],
  } as unknown as Solution;
  const files = {
    traverseProject: async (_project: unknown, callback: (item: unknown) => Promise<unknown>) =>
      Promise.all(
        (await fileSystem.readdir(fixtureDirectory)).map((file) =>
          callback({ file, uri: fixtureUri(file), type: 'file' }),
        ),
      ),
    load: async (uri: string) =>
      fileSystem.readFile(path.join(fixtureDirectory, uri.slice(fixtureBaseUri.length + 1)), 'utf8'),
  } as unknown as FileHandlingService;
  return scanSolutionModels(solution, files);
}

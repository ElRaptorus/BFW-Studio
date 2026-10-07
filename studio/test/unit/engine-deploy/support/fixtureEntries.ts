import type { Bifrost } from '#bifrost/Bifrost';
import type { SolutionModelEntry } from '#modules/engine-deploy/analysis/scanSolutionModels';
import { scanSolutionModels } from '#modules/engine-deploy/analysis/scanSolutionModels';
import { promises as fileSystem } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

export const fixtureDirectory = path.resolve(__dirname, '../../../fixtures/test-solution-deploy');
export const fixtureBaseUri = pathToFileURL(fixtureDirectory).href;
export const fixtureUri = (file: string): string => `${fixtureBaseUri}/${file}`;

/** Scans the `test-solution-deploy` fixture the same way the Studio scans an open solution. */
export async function scanDeployFixture(): Promise<SolutionModelEntry[]> {
  const fileNames = await fileSystem.readdir(fixtureDirectory);
  const bifrost = {
    solution: {
      listIncludedFileUris: async (pattern: RegExp) =>
        fileNames
          .filter((file) => pattern.test(file))
          .sort()
          .map(fixtureUri),
    },
    files: {
      load: async (uri: string) =>
        fileSystem.readFile(path.join(fixtureDirectory, uri.slice(fixtureBaseUri.length + 1)), 'utf8'),
    },
  } as unknown as Bifrost;
  return scanSolutionModels(bifrost);
}

import type { Bifrost } from '#bifrost/Bifrost';
import { scanSolutionDmnModels } from '#modules/dmn-core/scanSolutionDmnModels';
import { promises as fileSystem } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { describe, expect, it } from 'vitest';

const fixtureDirectory = path.resolve(__dirname, '../../fixtures/test-solution-deploy');
const baseUri = pathToFileURL(fixtureDirectory).href;

function createBifrost(fileNames: string[], overrides: Record<string, string> = {}): Bifrost {
  const uriFor = (file: string) => `${baseUri}/${file}`;
  return {
    solution: {
      listIncludedFileUris: async (pattern: RegExp) =>
        fileNames
          .filter((file) => pattern.test(file))
          .sort()
          .map(uriFor),
    },
    files: {
      load: async (uri: string) => {
        const file = uri.slice(baseUri.length + 1);
        return overrides[file] ?? fileSystem.readFile(path.join(fixtureDirectory, file), 'utf8');
      },
    },
  } as unknown as Bifrost;
}

describe('scanSolutionDmnModels', () => {
  it('lists the fixture decision sorted by URI with its definitions id and elements', async () => {
    const fileNames = await fileSystem.readdir(fixtureDirectory);
    const entries = await scanSolutionDmnModels(createBifrost(fileNames));

    expect(entries.map((entry) => entry.uri.slice(baseUri.length + 1))).toEqual(['discount-rules.dmn']);
    const [decision] = entries;
    expect(decision).toMatchObject({ kind: 'dmn', definitionsId: 'discount-rules' });
    if (decision.kind !== 'dmn') {
      throw new Error('discount-rules.dmn must scan as DMN');
    }
    expect(decision.elements.decisions.length).toBeGreaterThan(0);
    expect(decision.namespace).toEqual(expect.any(String));
    expect(decision.sha256).toMatch(/^[0-9a-f]{64}$/);
  });

  it('reports a non-model DMN file as invalid without stopping the scan', async () => {
    const fileNames = [...(await fileSystem.readdir(fixtureDirectory)), 'plain.dmn'];
    const entries = await scanSolutionDmnModels(createBifrost(fileNames, { 'plain.dmn': 'hello' }));

    expect(entries.find((entry) => entry.uri.endsWith('/plain.dmn'))?.kind).toBe('invalid');
    expect(entries.filter((entry) => entry.kind === 'dmn')).toHaveLength(1);
  });
});

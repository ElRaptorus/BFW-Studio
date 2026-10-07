import type { Bifrost } from '#bifrost/Bifrost';
import { sha256Hex } from '#bifrost/common/HashFunctions';

import { parseDmn } from '@elraptorus/bfw_engine_sdk';

export type SolutionDmnElement = { id: string; name: string | null };

export type SolutionDmnElements = {
  decisions: SolutionDmnElement[];
  businessKnowledgeModels: SolutionDmnElement[];
  inputData: SolutionDmnElement[];
};

export type SolutionDmnModelEntry =
  | {
      kind: 'dmn';
      uri: string;
      sha256: string;
      definitionsId: string | null;
      namespace: string | null;
      elements: SolutionDmnElements;
    }
  | { kind: 'invalid'; uri: string; error: string };

/**
 * ponytail: only checks that a `definitions` root opens and closes the file; mismatched tags inside a complete root
 * are not detected, because the SDK parsers do not validate. The upgrade path is a validating XML parser once one is a
 * declared dependency.
 */
const DEFINITIONS_ROOT_PATTERN = /<(?:[\w-]+:)?definitions[\s>][\s\S]*<\/(?:[\w-]+:)?definitions\s*>\s*$/;

/**
 * Reads and parses every included `.dmn` file of the open solution, sorted by URI. A file that cannot be read or
 * parsed becomes an `invalid` entry and does not stop the scan.
 *
 * ponytail: no cache, so every call re-reads every file and the cost grows with the file count. The upgrade path is a
 * cache invalidated on save and on solution change.
 */
export async function scanSolutionDmnModels(bifrost: Bifrost): Promise<SolutionDmnModelEntry[]> {
  const uris = await bifrost.solution.listIncludedFileUris(/\.dmn$/i);
  const entries = await Promise.all(
    uris.map(async (uri): Promise<SolutionDmnModelEntry> => {
      try {
        const text = await bifrost.files.load(uri);
        if (!DEFINITIONS_ROOT_PATTERN.test(text)) {
          return { kind: 'invalid', uri, error: 'The file has no complete <definitions> root element.' };
        }
        const definitions = parseDmn(text);
        const toElements = (items: { id: string; name: string | null }[]): SolutionDmnElement[] =>
          items.map((item) => ({ id: item.id, name: item.name }));
        return {
          kind: 'dmn',
          uri,
          sha256: await sha256Hex(text),
          definitionsId: definitions.id,
          namespace: definitions.namespace,
          elements: {
            decisions: toElements(definitions.decisions),
            businessKnowledgeModels: toElements(definitions.businessKnowledgeModels),
            inputData: toElements(definitions.inputData),
          },
        };
      } catch (error) {
        return { kind: 'invalid', uri, error: error instanceof Error ? error.message : String(error) };
      }
    }),
  );
  return entries.sort((first, second) => first.uri.localeCompare(second.uri));
}

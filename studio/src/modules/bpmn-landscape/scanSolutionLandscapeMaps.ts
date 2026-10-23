import type { Bifrost } from '#bifrost/Bifrost';
import type { Project } from '#bifrost/contracts/SolutionTypes';

import { parseLandscapeMap } from './LandscapeMapFile';
import { getLandscapeGate } from './landscapeFolder';

const MAP_FILE_PATTERN = '**/*.bfwmap';

export type LandscapeMapEntry = {
  uri: string;
  /** The name inside the file, else the file name without its extension. */
  name: string;
  /** `null` when the file reads; else the diagnostic of the read or parse failure. */
  error: string | null;
  /** The processes the map shows, in file order; empty for an unreadable map. */
  processReferences: { processId: string; fileHint: string | null }[];
};

async function scanMap(bifrost: Bifrost, uri: string): Promise<LandscapeMapEntry> {
  const fallbackName = bifrost.files.getLocalBasename(uri, true);
  let text: string;
  try {
    text = await bifrost.files.load(uri);
  } catch (error) {
    return {
      uri,
      name: fallbackName,
      error: error instanceof Error ? error.message : String(error),
      processReferences: [],
    };
  }
  // A new map file may still be empty; the editor treats it as an empty map.
  if (text.trim() === '') {
    return { uri, name: fallbackName, error: null, processReferences: [] };
  }
  const result = await parseLandscapeMap(text);
  if (!result.ok) {
    return { uri, name: fallbackName, error: result.errors.join(' '), processReferences: [] };
  }
  return {
    uri,
    name: result.map.name === '' ? fallbackName : result.map.name,
    error: null,
    processReferences: result.map.elements.flatMap((element) =>
      element.type === 'process' ? [{ processId: element.processId, fileHint: element.fileHint }] : [],
    ),
  };
}

/**
 * Reads every map in the landscape folder of the open solution, sorted by URI. Without a ready landscape gate there
 * are no maps. Only saved files count, like the BPMN catalog; there is no cache, because maps are small.
 *
 * ponytail: parses on the main thread on every solution change; cache by text hash like the BPMN scan once a
 * solution holds hundreds of maps.
 */
export async function scanSolutionLandscapeMaps(bifrost: Bifrost): Promise<LandscapeMapEntry[]> {
  const gate = getLandscapeGate(bifrost);
  if (gate.state !== 'ready') {
    return [];
  }
  // The folder may lie outside every project, so the solution's own file listing would miss it. The patterns are the
  // ones the Maps explorer lists the folder with, so an excluded map counts nowhere.
  const mapsFolder: Project = {
    type: 'project',
    id: 'view:landscapes',
    name: 'Maps',
    baseUri: gate.folderUri,
    files: {
      included: [MAP_FILE_PATTERN],
      excluded: [
        ...(bifrost.settings.get('std.fileExplorer.exclude') ?? []),
        ...bifrost.solution.getDefaultExcludedFiles(),
      ],
    },
  };
  const uris: string[] = [];
  try {
    await bifrost.files.traverseProject(mapsFolder, async (item) => {
      if (item.type === 'file' && /\.bfwmap$/i.test(item.uri)) {
        uris.push(item.uri);
      }
      return item;
    });
  } catch {
    // The folder does not exist yet; there are no maps.
    return [];
  }
  const entries = await Promise.all(uris.map((uri) => scanMap(bifrost, uri)));
  return entries.sort((first, second) => first.uri.localeCompare(second.uri));
}

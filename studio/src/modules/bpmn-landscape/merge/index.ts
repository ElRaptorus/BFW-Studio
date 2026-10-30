import type { Bifrost } from '#bifrost/Bifrost';
import type { MergeResolverHost } from '#bifrost/contracts/MergeTypes';

import { LANDSCAPE_DOCUMENT_TYPE } from '../landscapeFolder';
import * as LandscapeMergeChangeOverview from './panes/LandscapeMergeChangeOverview';

const ACTIONS = [
  'zoomToViewport',
  'zoomToActualSize',
  'zoomToSelectedElement',
  'selectNextConflict',
  'selectPreviousConflict',
  'acceptAllOurs',
  'acceptAllTheirs',
];

const resolverOf = (host: MergeResolverHost | null): any | null => host?.resolverRef?.current ?? null;

/** The `git.merge.<name>.bpmn-landscape-map` commands Git Cruiser dispatches to, and the merge pane. */
export function registerLandscapeMerge(bifrost: Bifrost): void {
  const register = (name: string, handler: (host: MergeResolverHost | null, ...args: any[]) => unknown) =>
    bifrost.commands.register(`git.merge.${name}.${LANDSCAPE_DOCUMENT_TYPE}`, handler);

  for (const name of ACTIONS) {
    register(name, (host) => {
      resolverOf(host)?.[name]();
    });
  }
  register('acceptOursForElement', (host, elementId: string) => {
    resolverOf(host)?.acceptOursForElement(elementId);
  });
  register('acceptTheirsForElement', (host, elementId: string) => {
    resolverOf(host)?.acceptTheirsForElement(elementId);
  });
  register('getCurrentConflictIndex', (host) => resolverOf(host)?.getCurrentConflictIndex() ?? null);
  register('getResultXml', async (host): Promise<string | null> => (await resolverOf(host)?.getResultXml()) ?? null);
  register('isFullyResolved', (host): boolean => resolverOf(host)?.isFullyResolved() ?? false);
  register('getResolutionProgress', (host) => resolverOf(host)?.getResolutionProgress() ?? null);

  bifrost.panes.prependToPaneGroup('right', 'property', [
    bifrost.panes.getPaneViaPaneProvider(
      'bpmn-landscape/panes/merge/LandscapeMergeChangeOverview',
      'bpmn-landscape/pane-providers/merge/LandscapeMergeChangeOverview',
      LandscapeMergeChangeOverview,
    ),
  ]);
}

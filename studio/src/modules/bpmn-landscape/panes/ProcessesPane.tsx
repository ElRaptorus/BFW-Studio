import type { Bifrost } from '#bifrost/Bifrost';
import type { PaneComponentProps, PaneProvider } from '#bifrost/contracts/PaneTypes';
import type { TreeBadge, TreeItem } from '#bifrost/contracts/TreeTypes';
import { Icon } from '#components/Icon';
import { Tree } from '#components/Tree/Tree';
import { Pane } from '#components/panes/Pane';
import { PaneHeader } from '#components/panes/PaneHeader';
import type { SolutionBpmnModelEntry } from '#modules/bpmn-core/scanSolutionBpmnModels';

import React, { useCallback, useMemo, useState, useSyncExternalStore } from 'react';

import LandscapeMapDocumentModel from '../LandscapeMapDocumentModel';
import type { LandscapeSolutionScan } from '../LandscapeSolutionScan';
import { LANDSCAPE_SOLUTION_SCAN_KEY } from '../LandscapeSolutionScan';
import { getLandscapeGate } from '../landscapeFolder';
import { resolveProcessReference } from '../resolveProcessReference';
import type { LandscapeMapEntry } from '../scanSolutionLandscapeMaps';

const BPMN_ICON = 'bpmn/editor-tab/bpmn';
const PROCESS_ICON = 'ph ph-flow-arrow';
const NO_ENTRIES: SolutionBpmnModelEntry[] = [];
/** Menus of the rows: `/process`, `/file` and `/multi-selection`, registered by the module. */
export const PROCESSES_MENU_ID = 'bpmn-landscape/processes';

export const paneProvider: PaneProvider = {
  getPaneTitle: () => 'Processes',
  Pane: PaneFull,
  PaneContent: PaneContent,
  classNames: 'app-layout__solution-pane',
  // Until the gate is ready the Maps explorer explains what is missing; this pane would only repeat it.
  shouldBeDisplayed: (_editorDocument, _editorDocumentModel, studio) => getLandscapeGate(studio).state === 'ready',
};

function PaneFull(props: PaneComponentProps): React.JSX.Element {
  return (
    <Pane classNames="app-layout__full-height-pane">
      <PaneHeader studio={props.studio} title="Processes" paneId={props.paneId} collapsed={props.collapsed} />
      {props.collapsed !== true && <PaneContent {...props} />}
    </Pane>
  );
}

const fileNameOf = (uri: string): string => uri.split('/').pop() ?? uri;

/** One collapsed row per BPMN file with its processes sorted by label; a filter keeps and expands matching files. */
function buildProcessTree(
  entries: SolutionBpmnModelEntry[],
  filterText: string,
  processIdsOnMap: Set<string>,
  mapCountByProcessKey: Map<string, number>,
): TreeItem[] {
  const filter = filterText.trim().toLowerCase();
  return [...entries]
    .sort((first, second) => fileNameOf(first.uri).localeCompare(fileNameOf(second.uri)))
    .flatMap((entry): TreeItem[] => {
      const fileName = fileNameOf(entry.uri);
      if (entry.kind === 'invalid') {
        return filter === '' || fileName.toLowerCase().includes(filter)
          ? [
              {
                type: 'directory',
                pathId: entry.uri,
                label: fileName,
                labelIcon: BPMN_ICON,
                labelTooltip: entry.error,
                badges: [{ type: 'character', character: '!' }],
                metadata: { fileUri: entry.uri },
                entries: [],
              },
            ]
          : [];
      }
      const fileMatches = filter === '' || fileName.toLowerCase().includes(filter);
      const processes = entry.processes
        .map((process) => ({ process, label: process.name || process.id }))
        .filter(
          ({ process, label }) =>
            fileMatches || label.toLowerCase().includes(filter) || process.id.toLowerCase().includes(filter),
        )
        .sort((first, second) => first.label.localeCompare(second.label));
      if (processes.length === 0) {
        return [];
      }
      return [
        {
          type: 'directory',
          pathId: entry.uri,
          label: fileName,
          labelIcon: BPMN_ICON,
          labelTooltip: entry.uri.replace(/^file:\/\//, ''),
          metadata: { fileUri: entry.uri },
          menuId: `${PROCESSES_MENU_ID}/file`,
          expanded: filter !== '',
          entries: processes.map(({ process, label }): TreeItem => {
            const mapCount = mapCountByProcessKey.get(`${entry.uri}#${process.id}`) ?? 0;
            const onMaps = mapCount === 0 ? '' : ` · on ${mapCount} ${mapCount === 1 ? 'map' : 'maps'}`;
            return {
              type: 'file',
              pathId: `${entry.uri}#${process.id}`,
              label,
              labelIcon: PROCESS_ICON,
              labelTooltip: `${process.id}${onMaps} — drag onto the map`,
              metadata: { processId: process.id, fileUri: entry.uri },
              menuId: `${PROCESSES_MENU_ID}/process`,
              badges: processBadges(mapCount, processIdsOnMap.has(process.id)),
            };
          }),
        },
      ];
    });
}

/** The number is how many maps of the solution show the process; the pin marks a process the open map shows. */
function processBadges(mapCount: number, isOnOpenMap: boolean): TreeBadge[] | undefined {
  const badges: TreeBadge[] = [];
  if (mapCount > 0) {
    badges.push({ type: 'number', number: mapCount });
  }
  if (isOnOpenMap) {
    badges.push({ type: 'icon', icon: 'ph ph-map-pin' });
  }
  return badges.length === 0 ? undefined : badges;
}

/** Saved maps per `<file uri>#<process id>`; a reference counts only where it resolves. */
function countMapsPerProcess(catalog: SolutionBpmnModelEntry[], maps: LandscapeMapEntry[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const map of maps) {
    const shownKeys = new Set<string>();
    for (const reference of map.processReferences) {
      const resolution = resolveProcessReference(catalog, map.uri, reference);
      if (resolution.status === 'resolved') {
        shownKeys.add(`${resolution.uri}#${resolution.process.id}`);
      }
    }
    shownKeys.forEach((key) => counts.set(key, (counts.get(key) ?? 0) + 1));
  }
  return counts;
}

function PaneContent(props: PaneComponentProps): React.JSX.Element {
  const bifrost: Bifrost = props.studio;
  const solutionScan = bifrost.getSharedRessource<LandscapeSolutionScan>(LANDSCAPE_SOLUTION_SCAN_KEY);
  const subscribeToScan = useCallback(
    (listener: () => void) => {
      const subscription = solutionScan.onDidChange(listener);
      return () => subscription.dispose();
    },
    [solutionScan],
  );
  const snapshot = useSyncExternalStore(subscribeToScan, () => solutionScan.getSnapshot());
  const [filterText, setFilterText] = useState('');
  const model = props.editorDocumentModel instanceof LandscapeMapDocumentModel ? props.editorDocumentModel : null;
  const processIdsOnMap = model?.getProcessIdsOnMap().join('\n') ?? '';

  const entries = snapshot?.catalog ?? NO_ENTRIES;
  const mapCountByProcessKey = useMemo(() => countMapsPerProcess(entries, snapshot?.maps ?? []), [entries, snapshot]);

  const treeEntries = useMemo(
    () => buildProcessTree(entries, filterText, new Set(processIdsOnMap.split('\n')), mapCountByProcessKey),
    [entries, filterText, processIdsOnMap, mapCountByProcessKey],
  );

  const onClick = useCallback((): void => undefined, []);

  return (
    <>
      <div className="pane-tab-input__outer" style={{ flex: 'none' }}>
        <input
          type="text"
          className="pane-tab-input"
          placeholder="Filter processes..."
          value={filterText}
          onChange={(event) => setFilterText(event.target.value)}
          data-test--landscape-process-filter
        />
      </div>
      <div className="pane__content pane__content--treeview pane__content--scroll-vertically">
        <Tree
          key={filterText}
          studio={bifrost}
          viewMediatorId="bpmn-landscape/processes"
          className="kbm-landscape-processes"
          entries={treeEntries}
          iconComponent={Icon}
          onClick={onClick}
          draggable
          multiSelectionMenuId={`${PROCESSES_MENU_ID}/multi-selection`}
        />
      </div>
    </>
  );
}

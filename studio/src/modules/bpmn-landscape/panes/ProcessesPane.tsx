import type { Bifrost } from '#bifrost/Bifrost';
import type { PaneComponentProps, PaneProvider } from '#bifrost/contracts/PaneTypes';
import type { TreeItem } from '#bifrost/contracts/TreeTypes';
import { Icon } from '#components/Icon';
import { Tree } from '#components/Tree/Tree';
import { Pane } from '#components/panes/Pane';
import { PaneHeader } from '#components/panes/PaneHeader';
import { PaneHeaderIcon } from '#components/panes/PaneHeaderIcon';
import type { SolutionBpmnModelEntry } from '#modules/bpmn-core/scanSolutionBpmnModels';
import { scanSolutionBpmnModels } from '#modules/bpmn-core/scanSolutionBpmnModels';

import React, { useCallback, useEffect, useMemo, useState } from 'react';

import LandscapeMapDocumentModel from '../LandscapeMapDocumentModel';

const BPMN_ICON = 'bpmn/editor-tab/bpmn';
const PROCESS_ICON = 'ph ph-flow-arrow';

export const paneProvider: PaneProvider = {
  getPaneTitle: () => 'Processes',
  Pane: PaneFull,
  PaneContent: PaneContent,
};

function PaneFull(props: PaneComponentProps): React.JSX.Element {
  return (
    <Pane classNames="app-layout__full-height-pane">
      <PaneHeader studio={props.studio} title="Processes" paneId={props.paneId} collapsed={props.collapsed}>
        {props.collapsed !== true && (
          <PaneHeaderIcon
            studio={props.studio}
            icon="ph ph-file-plus"
            tooltip="New Map..."
            command="bpmn.landscape.newMap"
            dataTestId="landscape-new-map"
          />
        )}
      </PaneHeader>
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
          expanded: filter !== '',
          entries: processes.map(({ process, label }): TreeItem => ({
            type: 'file',
            pathId: `${entry.uri}#${process.id}`,
            label,
            labelIcon: PROCESS_ICON,
            labelTooltip: `${process.id} — drag onto the map`,
            metadata: { processId: process.id, fileUri: entry.uri },
            badges: processIdsOnMap.has(process.id) ? [{ type: 'icon', icon: 'ph ph-map-pin' }] : undefined,
          })),
        },
      ];
    });
}

function PaneContent(props: PaneComponentProps): React.JSX.Element {
  const bifrost: Bifrost = props.studio;
  const solution = bifrost.solution.getSolution();
  const [entries, setEntries] = useState<SolutionBpmnModelEntry[]>([]);
  const [filterText, setFilterText] = useState('');
  const model = props.editorDocumentModel instanceof LandscapeMapDocumentModel ? props.editorDocumentModel : null;
  const processIdsOnMap = model?.getProcessIdsOnMap().join('\n') ?? '';

  // The solution object stays the same when its files change, so the scan follows `solutionChanged`.
  useEffect(() => {
    let latestScan = 0;
    const scan = (): void => {
      const scanNumber = ++latestScan;
      void scanSolutionBpmnModels(bifrost).then((scanned) => {
        if (scanNumber === latestScan) {
          setEntries(scanned);
        }
      });
    };
    scan();
    const subscription = bifrost.events.on('solutionChanged', scan);
    return () => {
      latestScan = -1;
      subscription.dispose();
    };
  }, [bifrost, solution]);

  const treeEntries = useMemo(
    () => buildProcessTree(entries, filterText, new Set(processIdsOnMap.split('\n'))),
    [entries, filterText, processIdsOnMap],
  );

  const onClick = useCallback((): void => undefined, []);
  // The Tree makes rows draggable only when a drop handler is set; rows carry no `uri`, so nothing drops inside it.
  const onDragAndDropItem = useCallback((): void => undefined, []);

  if (solution == null) {
    return <p className="pane__content text-center py-4">Open a solution to see its processes.</p>;
  }

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
          onDragAndDropItem={onDragAndDropItem}
        />
      </div>
    </>
  );
}

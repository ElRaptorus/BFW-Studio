import type { TreeItem } from '#bifrost/contracts/TreeTypes';
import type { SolutionBpmnModelEntry } from '#modules/bpmn-core/scanSolutionBpmnModels';

import type { InteractionSelectedProcessReference } from './buildInteractionGraph';

const BPMN_ICON = 'bpmn/editor-tab/bpmn';
const PROCESS_ICON = 'ph ph-flow-arrow';

const fileNameOf = (uri: string): string => uri.split('/').pop() ?? uri;

function processReferenceKey(reference: InteractionSelectedProcessReference): string {
  return `${reference.uri}#${reference.processId}`;
}

/** Checked when every listed process is selected, mixed when some are; the master and file checkboxes share it. */
export function listedProcessesCheckboxState(
  references: InteractionSelectedProcessReference[],
  isProcessSelected: (reference: InteractionSelectedProcessReference) => boolean,
): 'checked' | 'unchecked' | 'mixed' {
  const selectedCount = references.filter((reference) => isProcessSelected(reference)).length;
  if (selectedCount === 0) {
    return 'unchecked';
  }
  return selectedCount === references.length ? 'checked' : 'mixed';
}

/** Every process row that the current filter would show in the Processes pane tree. */
export function collectFilteredProcessReferences(
  entries: SolutionBpmnModelEntry[],
  filterText: string,
): InteractionSelectedProcessReference[] {
  const filter = filterText.trim().toLowerCase();
  const references: InteractionSelectedProcessReference[] = [];
  for (const entry of entries) {
    if (entry.kind !== 'bpmn') {
      continue;
    }
    const fileName = fileNameOf(entry.uri);
    const fileMatches = filter === '' || fileName.toLowerCase().includes(filter);
    for (const process of entry.processes) {
      const label = process.name || process.id;
      if (fileMatches || label.toLowerCase().includes(filter) || process.id.toLowerCase().includes(filter)) {
        references.push({ uri: entry.uri, processId: process.id });
      }
    }
  }
  return references.sort(
    (first, second) => first.uri.localeCompare(second.uri) || first.processId.localeCompare(second.processId),
  );
}

/** One collapsed row per BPMN file with its processes; a filter keeps and expands matching files. */
export function buildInteractionsProcessTree(
  entries: SolutionBpmnModelEntry[],
  filterText: string,
  isProcessSelected: (reference: InteractionSelectedProcessReference) => boolean,
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
                metadata: { fileUri: entry.uri, invalid: true },
                entries: [],
              },
            ]
          : [];
      }
      if (entry.kind !== 'bpmn') {
        return [];
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
      const listedReferences = processes.map(({ process }) => ({ uri: entry.uri, processId: process.id }));
      return [
        {
          type: 'directory',
          pathId: entry.uri,
          label: fileName,
          labelIcon: BPMN_ICON,
          labelTooltip: entry.uri.replace(/^file:\/\//, ''),
          metadata: { fileUri: entry.uri },
          expanded: filter !== '',
          checkboxState: listedProcessesCheckboxState(listedReferences, isProcessSelected),
          entries: processes.map(({ process, label }): TreeItem => {
            const reference = { uri: entry.uri, processId: process.id };
            const selected = isProcessSelected(reference);
            return {
              type: 'file',
              pathId: processReferenceKey(reference),
              label,
              labelIcon: PROCESS_ICON,
              labelTooltip: process.id,
              metadata: { processId: process.id, fileUri: entry.uri, reference },
              checkboxState: selected ? 'checked' : 'unchecked',
            };
          }),
        },
      ];
    });
}

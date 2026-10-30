import type { MergeFileType } from '#bifrost/contracts/MergeTypes';
import * as path from 'path';

type ModelFileType = {
  /** Commands of the type module are named `<commandPrefix>.diff.<name>`. */
  readonly commandPrefix: string;
  readonly mergeFileType: MergeFileType;
  readonly icon: string;
  readonly label: string;
};

type ModelCommandName = 'openHistoryPreview' | 'openDiffTwoFiles' | 'getChangeDigest' | 'getChangeSummaryMarkdown';

const MODEL_FILE_TYPES = new Map<string, ModelFileType>([
  ['.bpmn', { commandPrefix: 'bpmn', mergeFileType: 'bpmn', icon: 'ph-light ph-flow-arrow', label: 'Process' }],
  ['.dmn', { commandPrefix: 'dmn', mergeFileType: 'dmn', icon: 'ph-light ph-table', label: 'Decision' }],
  [
    '.bfwmap',
    {
      commandPrefix: 'bpmn.landscape',
      mergeFileType: 'landscape',
      icon: 'ph-light ph-map-trifold',
      label: 'Landscape map',
    },
  ],
]);

export function getModelFileType(filePath: string): ModelFileType | null {
  return MODEL_FILE_TYPES.get(path.extname(filePath).toLowerCase()) ?? null;
}

export function getModelCommand(filePath: string, name: ModelCommandName): string | null {
  const modelFileType = getModelFileType(filePath);
  return modelFileType == null ? null : `${modelFileType.commandPrefix}.diff.${name}`;
}

export function isModelFile(filePath: string): boolean {
  return getModelFileType(filePath) != null;
}

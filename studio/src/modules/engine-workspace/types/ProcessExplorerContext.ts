import type { ProcessModel } from '@elraptorus/daemonengine_sdk';

export interface ProcessExplorerContextMetadata {
  engineId: string;
  processModel: ProcessModel;
  columnId?: string;
  cellValue?: string;
}

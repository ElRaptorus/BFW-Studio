import type { ProcessModel } from '@elraptorus/bfw_engine_sdk';

export interface ProcessExplorerContextMetadata {
  engineId: string;
  processModel: ProcessModel;
  columnId?: string;
  cellValue?: string;
}

import type { FlowNodeInstance } from '@elraptorus/bfw_engine_sdk';

export interface TaskInboxContextMetadata {
  engineId: string;
  task: FlowNodeInstance;
  columnId?: string;
  cellValue?: string;
}

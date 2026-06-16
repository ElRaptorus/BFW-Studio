import type { FlowNodeInstance } from '@elraptorus/daemonengine_sdk';

export interface TaskInboxContextMetadata {
  engineId: string;
  task: FlowNodeInstance;
  columnId?: string;
  cellValue?: string;
}

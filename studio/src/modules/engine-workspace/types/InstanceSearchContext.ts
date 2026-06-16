import type { ProcessInstance } from '@elraptorus/daemonengine_sdk';

export interface InstanceSearchContextMetadata {
  engineId: string;
  instance: ProcessInstance;
  columnId?: string;
  cellValue?: string;
}

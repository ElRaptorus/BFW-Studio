import type { ProcessInstance } from '@elraptorus/bfw_engine_sdk';

export interface InstanceSearchContextMetadata {
  engineId: string;
  instance: ProcessInstance;
  columnId?: string;
  cellValue?: string;
}

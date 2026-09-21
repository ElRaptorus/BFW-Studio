import type { DecisionDefinition } from '@elraptorus/bfw_engine_sdk';

export interface DecisionCatalogContextMetadata {
  engineId: string;
  decision: DecisionDefinition;
  columnId?: string;
  cellValue?: string;
}

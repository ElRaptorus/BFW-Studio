import type { DecisionDefinition } from '@elraptorus/daemonengine_sdk';

export interface DecisionCatalogContextMetadata {
  engineId: string;
  decision: DecisionDefinition;
  columnId?: string;
  cellValue?: string;
}

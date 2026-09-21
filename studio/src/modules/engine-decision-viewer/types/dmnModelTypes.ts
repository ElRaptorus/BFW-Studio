import type { parseDmn } from '@elraptorus/bfw_engine_sdk';

/** Parsed DMN model returned by SDK {@link parseDmn}. */
export type DmnDefinitions = ReturnType<typeof parseDmn>;

export type DmnDecision = DmnDefinitions['decisions'][number];
export type DmnBusinessKnowledgeModel = DmnDefinitions['businessKnowledgeModels'][number];
export type DmnInputData = DmnDefinitions['inputData'][number];
export type DmnKnowledgeSource = DmnDefinitions['knowledgeSources'][number];
export type DmnItemDefinition = DmnDefinitions['itemDefinitions'][number];
export type DmnDecisionService = DmnDefinitions['decisionServices'][number];
export type DmnImport = DmnDefinitions['imports'][number];
export type DmnDiagram = NonNullable<DmnDefinitions['dmndi']>['diagrams'][number];
export type DmnShape = DmnDiagram['shapes'][number];
export type DmnEdge = DmnDiagram['edges'][number];
export type DmnDecisionTable = Extract<DmnDecision['expression'], { hitPolicy: string }>;
export type DmnExpressionBody = NonNullable<DmnDecision['expression']>;

export type DrgElementType =
  | 'decision'
  | 'businessKnowledgeModel'
  | 'inputData'
  | 'knowledgeSource'
  | 'itemDefinition'
  | 'decisionService'
  | 'import';

export interface DrgSelection {
  type: DrgElementType;
  elementId: string;
}

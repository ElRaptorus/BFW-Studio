export enum DmnElementType {
  Decision = 'dmn:Decision',
  InputData = 'dmn:InputData',
  BusinessKnowledgeModel = 'dmn:BusinessKnowledgeModel',
  KnowledgeSource = 'dmn:KnowledgeSource',
  DecisionService = 'dmn:DecisionService',
  TextAnnotation = 'dmn:TextAnnotation',
  Association = 'dmn:Association',
  InformationRequirement = 'dmn:InformationRequirement',
  KnowledgeRequirement = 'dmn:KnowledgeRequirement',
  AuthorityRequirement = 'dmn:AuthorityRequirement',
}

export type DmnExpressionType =
  | 'decisionTable'
  | 'literalExpression'
  | 'context'
  | 'invocation'
  | 'list'
  | 'relation'
  | 'conditional'
  | 'filter'
  | 'for'
  | 'every'
  | 'some'
  | 'functionDefinition'
  | 'none';

export type DmnElement = {
  id: string;
  name: string;
  type: DmnElementType;
  businessObject: any;
};

export type DmnHitPolicy = 'UNIQUE' | 'FIRST' | 'ANY' | 'COLLECT' | 'RULE ORDER' | 'OUTPUT ORDER' | 'PRIORITY';

export type DmnAggregation = 'SUM' | 'MIN' | 'MAX' | 'COUNT' | '';

export const DMN_HIT_POLICIES: DmnHitPolicy[] = [
  'UNIQUE',
  'FIRST',
  'ANY',
  'COLLECT',
  'RULE ORDER',
  'OUTPUT ORDER',
  'PRIORITY',
];

export const DMN_AGGREGATIONS: DmnAggregation[] = ['SUM', 'MIN', 'MAX', 'COUNT', ''];

export const FEEL_BUILTIN_TYPES: string[] = [
  'string',
  'number',
  'boolean',
  'date',
  'time',
  'dateTime',
  'dayTimeDuration',
  'yearMonthDuration',
  'Any',
];

export const MODDLE_DMN_DECISION_TYPE = 'dmn:Decision';
export const MODDLE_DMN_INPUT_DATA_TYPE = 'dmn:InputData';
export const MODDLE_DMN_BKM_TYPE = 'dmn:BusinessKnowledgeModel';
export const MODDLE_DMN_KNOWLEDGE_SOURCE_TYPE = 'dmn:KnowledgeSource';
export const MODDLE_DMN_DECISION_SERVICE_TYPE = 'dmn:DecisionService';
export const MODDLE_DMN_TEXT_ANNOTATION_TYPE = 'dmn:TextAnnotation';
export const MODDLE_DMN_ASSOCIATION_TYPE = 'dmn:Association';
export const MODDLE_DMN_INFORMATION_REQUIREMENT_TYPE = 'dmn:InformationRequirement';
export const MODDLE_DMN_KNOWLEDGE_REQUIREMENT_TYPE = 'dmn:KnowledgeRequirement';
export const MODDLE_DMN_AUTHORITY_REQUIREMENT_TYPE = 'dmn:AuthorityRequirement';

const MODDLE_TYPE_TO_ELEMENT_TYPE: Record<string, DmnElementType> = {
  [MODDLE_DMN_DECISION_TYPE]: DmnElementType.Decision,
  [MODDLE_DMN_INPUT_DATA_TYPE]: DmnElementType.InputData,
  [MODDLE_DMN_BKM_TYPE]: DmnElementType.BusinessKnowledgeModel,
  [MODDLE_DMN_KNOWLEDGE_SOURCE_TYPE]: DmnElementType.KnowledgeSource,
  [MODDLE_DMN_DECISION_SERVICE_TYPE]: DmnElementType.DecisionService,
  [MODDLE_DMN_TEXT_ANNOTATION_TYPE]: DmnElementType.TextAnnotation,
  [MODDLE_DMN_ASSOCIATION_TYPE]: DmnElementType.Association,
  [MODDLE_DMN_INFORMATION_REQUIREMENT_TYPE]: DmnElementType.InformationRequirement,
  [MODDLE_DMN_KNOWLEDGE_REQUIREMENT_TYPE]: DmnElementType.KnowledgeRequirement,
  [MODDLE_DMN_AUTHORITY_REQUIREMENT_TYPE]: DmnElementType.AuthorityRequirement,
};

export function resolveElementType(moddleType: string): DmnElementType | null {
  return MODDLE_TYPE_TO_ELEMENT_TYPE[moddleType] ?? null;
}

export function getExpressionType(businessObject: any): DmnExpressionType {
  const expression = businessObject?.decisionLogic ?? businessObject?.expression;
  if (expression == null) {
    return 'none';
  }

  const typeMap: Record<string, DmnExpressionType> = {
    'dmn:DecisionTable': 'decisionTable',
    'dmn:LiteralExpression': 'literalExpression',
    'dmn:Context': 'context',
    'dmn:Invocation': 'invocation',
    'dmn:List': 'list',
    'dmn:Relation': 'relation',
    'dmn:Conditional': 'conditional',
    'dmn:Filter': 'filter',
    'dmn:For': 'for',
    'dmn:Every': 'every',
    'dmn:Some': 'some',
    'dmn:FunctionDefinition': 'functionDefinition',
  };

  return typeMap[expression.$type] ?? 'none';
}

export function getExpressionTypeLabel(expressionType: DmnExpressionType): string {
  const labels: Record<DmnExpressionType, string> = {
    decisionTable: 'Decision Table',
    literalExpression: 'Literal Expression',
    context: 'Boxed Context',
    invocation: 'Invocation',
    list: 'List',
    relation: 'Relation',
    conditional: 'Conditional',
    filter: 'Filter',
    for: 'For',
    every: 'Every',
    some: 'Some',
    functionDefinition: 'Function Definition',
    none: 'None',
  };
  return labels[expressionType];
}

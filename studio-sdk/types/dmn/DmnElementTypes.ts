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

export type DmnHitPolicy = 'UNIQUE' | 'FIRST' | 'ANY' | 'COLLECT' | 'RULE ORDER' | 'OUTPUT ORDER' | 'PRIORITY';

export type DmnAggregation = 'SUM' | 'MIN' | 'MAX' | 'COUNT' | '';

export type DmnElement = {
  readonly id: string;
  readonly name: string;
  readonly type: DmnElementType;
  readonly businessObject: any;
};

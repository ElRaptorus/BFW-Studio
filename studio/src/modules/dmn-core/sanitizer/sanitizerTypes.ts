type IssueType_ShapelessDecision = { type: 'shapeless-decision'; category: 'ghost-element'; severity: 'error' };
type IssueType_ShapelessInputData = { type: 'shapeless-input-data'; category: 'ghost-element'; severity: 'error' };
type IssueType_ShapelessBkm = { type: 'shapeless-bkm'; category: 'ghost-element'; severity: 'error' };
type IssueType_ShapelessKnowledgeSource = {
  type: 'shapeless-knowledge-source';
  category: 'ghost-element';
  severity: 'error';
};
type IssueType_ShapelessDecisionService = {
  type: 'shapeless-decision-service';
  category: 'ghost-element';
  severity: 'error';
};
type IssueType_ZombieShape = { type: 'zombie-shape'; category: 'zombie-element'; severity: 'warning' };
type IssueType_ZombieEdge = { type: 'zombie-edge'; category: 'zombie-element'; severity: 'warning' };
type IssueType_UnreferencedItemDefinition = {
  type: 'unreferenced-item-definition';
  category: 'unreferenced-definition';
  severity: 'info';
};
type IssueType_UnreferencedImport = {
  type: 'unreferenced-import';
  category: 'unreferenced-definition';
  severity: 'info';
};
type IssueType_DanglingRequirementRef = {
  type: 'dangling-requirement-ref';
  category: 'dangling-reference';
  severity: 'warning';
};
type IssueType_DanglingDmnElementRef = {
  type: 'dangling-dmn-element-ref';
  category: 'dangling-reference';
  severity: 'warning';
};
type IssueType_EmptyExtensionElements = {
  type: 'empty-extension-elements';
  category: 'empty-container';
  severity: 'warning';
};

export type DmnSanitizerIssueType =
  | IssueType_ShapelessDecision
  | IssueType_ShapelessInputData
  | IssueType_ShapelessBkm
  | IssueType_ShapelessKnowledgeSource
  | IssueType_ShapelessDecisionService
  | IssueType_ZombieShape
  | IssueType_ZombieEdge
  | IssueType_UnreferencedItemDefinition
  | IssueType_UnreferencedImport
  | IssueType_DanglingRequirementRef
  | IssueType_DanglingDmnElementRef
  | IssueType_EmptyExtensionElements;

export type DmnSanitizerIssueTypeDiscriminant = DmnSanitizerIssueType['type'];
export type DmnSanitizerIssueCategory = DmnSanitizerIssueType['category'];
export type DmnSanitizerIssueSeverity = DmnSanitizerIssueType['severity'];

export type DmnSanitizableIssue = DmnSanitizerIssueType & {
  label: string;
  elementId: string;
  elementName?: string;
  elementType: string;
};

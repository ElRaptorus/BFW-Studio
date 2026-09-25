// --- Issue type definitions (one per issue kind) ---

type IssueType_ShapelessFlowNode = { type: 'shapeless-flow-node'; category: 'ghost-element'; severity: 'error' };
type IssueType_ShapelessParticipant = { type: 'shapeless-participant'; category: 'ghost-element'; severity: 'error' };
type IssueType_ShapelessSequenceFlow = {
  type: 'shapeless-sequence-flow';
  category: 'ghost-element';
  severity: 'error';
};
type IssueType_ShapelessMessageFlow = {
  type: 'shapeless-message-flow';
  category: 'ghost-element';
  severity: 'error';
};
type IssueType_UnreferencedMessage = {
  type: 'unreferenced-message';
  category: 'unreferenced-global';
  severity: 'info';
};
type IssueType_UnreferencedError = { type: 'unreferenced-error'; category: 'unreferenced-global'; severity: 'info' };
type IssueType_UnreferencedSignal = { type: 'unreferenced-signal'; category: 'unreferenced-global'; severity: 'info' };
type IssueType_UnreferencedEscalation = {
  type: 'unreferenced-escalation';
  category: 'unreferenced-global';
  severity: 'info';
};
type IssueType_DanglingMessageRef = {
  type: 'dangling-message-ref';
  category: 'dangling-reference';
  severity: 'warning';
};
type IssueType_DanglingErrorRef = { type: 'dangling-error-ref'; category: 'dangling-reference'; severity: 'warning' };
type IssueType_DanglingSignalRef = {
  type: 'dangling-signal-ref';
  category: 'dangling-reference';
  severity: 'warning';
};
type IssueType_DanglingEscalationRef = {
  type: 'dangling-escalation-ref';
  category: 'dangling-reference';
  severity: 'warning';
};
type IssueType_EmptyExtensionElements = {
  type: 'empty-extension-elements';
  category: 'empty-container';
  severity: 'warning';
};
type IssueType_EmptyBfwProperties = {
  type: 'empty-bfw-properties';
  category: 'empty-container';
  severity: 'warning';
};
type IssueType_ZombieShape = { type: 'zombie-shape'; category: 'zombie-element'; severity: 'warning' };
type IssueType_ZombieEdge = { type: 'zombie-edge'; category: 'zombie-element'; severity: 'warning' };

// --- Union of all issue types ---

export type SanitizerIssueType =
  | IssueType_ShapelessFlowNode
  | IssueType_ShapelessParticipant
  | IssueType_ShapelessSequenceFlow
  | IssueType_ShapelessMessageFlow
  | IssueType_ZombieShape
  | IssueType_ZombieEdge
  | IssueType_UnreferencedMessage
  | IssueType_UnreferencedError
  | IssueType_UnreferencedSignal
  | IssueType_UnreferencedEscalation
  | IssueType_DanglingMessageRef
  | IssueType_DanglingErrorRef
  | IssueType_DanglingSignalRef
  | IssueType_DanglingEscalationRef
  | IssueType_EmptyExtensionElements
  | IssueType_EmptyBfwProperties;

// --- Derived helper types ---

export type SanitizerIssueTypeDiscriminant = SanitizerIssueType['type'];
export type SanitizerIssueCategory = SanitizerIssueType['category'];
export type SanitizerIssueSeverity = SanitizerIssueType['severity'];

// --- The issue instance: issue type (discriminated) + per-instance data ---

export type SanitizableIssue = SanitizerIssueType & {
  label: string;
  elementId: string;
  elementName?: string;
  elementType: string;
  /** No automatic fix exists; the issue is shown but has no quick-fix and Fix All skips it. */
  manualFixOnly?: true;
};

/**
 * Layout changes for these BPMN types are noise in the summary
 * (they always change when their children move and carry no useful info).
 */
export const LAYOUT_CHANGE_REJECTED_TYPES = /^bpmn:(Lane|Participant|SequenceFlow)$/;

export const ATTRIBUTE_LABELS: Record<string, string> = {
  $type: 'Element Type',
  id: 'Element ID',
  name: 'Element Name',
  calledElement: 'Process',
  'documentation[0]': 'Documentation',
  'eventDefinitions[0]': 'Event Definitions',
  extensionElements: 'Extension Elements',
};

/** Compared on `bpmn:Definitions` for file-level diff summaries. */
export const DEFINITIONS_METADATA_KEYS: readonly string[] = [
  'targetNamespace',
  'exporter',
  'exporterVersion',
  'typeLanguage',
  'expressionLanguage',
  'executionPlatform',
  'executionPlatformVersion',
];

export const DEFINITIONS_METADATA_LABELS: Record<string, string> = {
  targetNamespace: 'Target namespace',
  exporter: 'Exporter',
  exporterVersion: 'Exporter version',
  typeLanguage: 'Type language',
  expressionLanguage: 'Expression language',
  executionPlatform: 'Execution platform',
  executionPlatformVersion: 'Execution platform version',
};

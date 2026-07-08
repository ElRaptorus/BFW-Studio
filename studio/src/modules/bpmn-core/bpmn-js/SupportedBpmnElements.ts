type SupportedBpmnElementListEntry = {
  type: string;
  label?: string;
  supportedEventDefinitions: string[];
};

export const SupportedBpmnElements: SupportedBpmnElementListEntry[] = [
  {
    type: 'bpmn:StartEvent',
    supportedEventDefinitions: [
      '',
      'bpmn:MessageEventDefinition',
      'bpmn:TimerEventDefinition',
      'bpmn:SignalEventDefinition',
      'bpmn:ErrorEventDefinition',
      'bpmn:ConditionalEventDefinition',
      'bpmn:EscalationEventDefinition',
    ],
  },
  {
    type: 'bpmn:Task',
    supportedEventDefinitions: [''],
  },
  {
    type: 'bpmn:UserTask',
    supportedEventDefinitions: [''],
  },
  {
    type: 'bpmn:ManualTask',
    supportedEventDefinitions: [''],
  },
  {
    type: 'bpmn:ReceiveTask',
    supportedEventDefinitions: [''],
  },
  {
    type: 'bpmn:SendTask',
    supportedEventDefinitions: [''],
  },
  {
    type: 'bpmn:ScriptTask',
    supportedEventDefinitions: [''],
  },
  {
    type: 'bpmn:ServiceTask',
    supportedEventDefinitions: [''],
  },
  {
    type: 'bpmn:EndEvent',
    supportedEventDefinitions: [
      '',
      'bpmn:MessageEventDefinition',
      'bpmn:SignalEventDefinition',
      'bpmn:ErrorEventDefinition',
      'bpmn:TerminateEventDefinition',
      'bpmn:EscalationEventDefinition',
    ],
  },
  {
    type: 'bpmn:CallActivity',
    supportedEventDefinitions: [''],
  },
  {
    type: 'bpmn:Lane',
    supportedEventDefinitions: [''],
  },
  {
    type: 'bpmn:Participant',
    supportedEventDefinitions: [''],
  },
  {
    type: 'bpmn:BoundaryEvent',
    supportedEventDefinitions: [
      '',
      'bpmn:MessageEventDefinition',
      'bpmn:TimerEventDefinition',
      'bpmn:SignalEventDefinition',
      'bpmn:ErrorEventDefinition',
      'bpmn:ConditionalEventDefinition',
      'bpmn:EscalationEventDefinition',
    ],
  },
  {
    type: 'bpmn:IntermediateThrowEvent',
    supportedEventDefinitions: [
      '',
      'bpmn:MessageEventDefinition',
      'bpmn:LinkEventDefinition',
      'bpmn:SignalEventDefinition',
      'bpmn:EscalationEventDefinition',
    ],
  },
  {
    type: 'bpmn:IntermediateCatchEvent',
    supportedEventDefinitions: [
      '',
      'bpmn:MessageEventDefinition',
      'bpmn:LinkEventDefinition',
      'bpmn:SignalEventDefinition',
      'bpmn:TimerEventDefinition',
      'bpmn:ConditionalEventDefinition',
    ],
  },
  {
    type: 'bpmn:ExclusiveGateway',
    supportedEventDefinitions: [''],
  },
  {
    type: 'bpmn:ParallelGateway',
    supportedEventDefinitions: [''],
  },
  {
    type: 'bpmn:InclusiveGateway',
    supportedEventDefinitions: [''],
  },
  {
    type: 'bpmn:ComplexGateway',
    supportedEventDefinitions: [''],
  },
  {
    type: 'bpmn:SequenceFlow',
    supportedEventDefinitions: [''],
  },
  {
    type: 'bpmn:SubProcess',
    supportedEventDefinitions: [''],
  },
  {
    type: 'bpmn:EventSubProcess',
    supportedEventDefinitions: [''],
  },
  {
    type: 'bpmn:Association',
    supportedEventDefinitions: [''],
  },
  {
    type: 'bpmn:TextAnnotation',
    supportedEventDefinitions: [''],
  },
  {
    type: 'bpmn:Group',
    supportedEventDefinitions: [''],
  },
  {
    type: 'label',
    supportedEventDefinitions: [''],
  },
  {
    type: 'bpmn:Collaboration',
    supportedEventDefinitions: [''],
  },
  {
    type: 'bpmn:EventBasedGateway',
    label: 'Event-based gateway',
    supportedEventDefinitions: [''],
  },
  {
    type: 'bpmn:DataOutputAssociation',
    supportedEventDefinitions: [''],
  },
  {
    type: 'bpmn:DataInputAssociation',
    supportedEventDefinitions: [''],
  },
  {
    type: 'bpmn:DataObjectReference',
    supportedEventDefinitions: [''],
  },
  {
    type: 'bpmn:BusinessRuleTask',
    supportedEventDefinitions: [''],
  },
  {
    type: 'bpmn:EmptyPool',
    label: 'Empty pool/participant (removes content)',
    supportedEventDefinitions: [''],
  },
  {
    type: 'bpmn:ExpandedPool',
    supportedEventDefinitions: [''],
  },
];

type SupportedPopupMenuHeaderEntry = {
  title: string;
};

export const SupportedPopupMenuHeaderEntries: SupportedPopupMenuHeaderEntry[] = [
  { title: 'Loop' },
  { title: 'Parallel Multi-Instance' },
  { title: 'Sequential Multi-Instance' },
  { title: 'Collection' },
  { title: 'Participant Multiplicity' },
];

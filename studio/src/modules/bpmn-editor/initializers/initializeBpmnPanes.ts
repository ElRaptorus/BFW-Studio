import type { Bifrost } from '#bifrost/Bifrost';

export function initializeBpmnPanes(bifrost: Bifrost): void {
  bifrost.panes.prependToPaneGroup('right', 'property', [
    bifrost.panes.getPaneViaPaneProvider(
      'bpmn/panes/merge/BpmnMergeChangeOverview',
      'bpmn/pane-providers/merge/BpmnMergeChangeOverview',
      require('../merge/panes/BpmnMergeChangeOverview'),
    ),
  ]);

  bifrost.panes.prependToPaneGroup('right', 'property', [
    // Consolidated element info
    bifrost.panes.getPaneViaPaneProvider(
      'bpmn/panes/properties/PropertiesElementInfo',
      'bpmn/pane-providers/properties/PropertiesElementInfo',
      require('../panes/properties/PropertiesElementInfo'),
    ),

    // Gateway flow links
    bifrost.panes.getPaneViaPaneProvider(
      'bpmn/panes/properties/PropertiesGatewayIncomingFlows',
      'bpmn/pane-providers/properties/PropertiesGatewayIncomingFlows',
      require('../panes/properties/PropertiesGatewayIncomingFlows'),
    ),
    bifrost.panes.getPaneViaPaneProvider(
      'bpmn/panes/properties/PropertiesGatewayOutgoingFlows',
      'bpmn/pane-providers/properties/PropertiesGatewayOutgoingFlows',
      require('../panes/properties/PropertiesGatewayOutgoingFlows'),
    ),

    // Complex Gateway join activation condition (FEEL)
    bifrost.panes.getPaneViaPaneProvider(
      'bpmn/panes/properties/PropertiesComplexGatewayActivationCondition',
      'bpmn/pane-providers/properties/PropertiesComplexGatewayActivationCondition',
      require('../panes/properties/ComplexGateway/PropertiesComplexGatewayActivationCondition'),
    ),

    // Generic panes (any element or multi-selection)
    bifrost.panes.getPaneViaPaneProvider(
      'bpmn/panes/properties_basic',
      'bpmn/pane-providers/properties_basic',
      require('../panes/properties/PropertiesBasic'),
    ),
    bifrost.panes.getPaneViaPaneProvider(
      'bpmn/panes/properties/PropertiesDefinition',
      'bpmn/pane-providers/properties/PropertiesDefinition',
      require('../panes/properties/PropertiesDefinition'),
    ),
    bifrost.panes.getPaneViaPaneProvider(
      'bpmn/panes/properties/PropertiesSubprocessContext',
      'bpmn/pane-providers/properties/PropertiesSubprocessContext',
      require('../panes/properties/PropertiesSubprocessContext'),
    ),
    bifrost.panes.getPaneViaPaneProvider(
      'bpmn/panes/properties/PropertiesProcesses',
      'bpmn/pane-providers/properties/PropertiesProcesses',
      require('../panes/properties/PropertiesProcesses'),
    ),
    bifrost.panes.getPaneViaPaneProvider(
      'bpmn/panes/properties_process',
      'bpmn/pane-providers/properties_process',
      require('../panes/properties/PropertiesProcess'),
    ),
    bifrost.panes.getPaneViaPaneProvider(
      'bpmn/panes/selected_elements',
      'bpmn/pane-providers/selected_elements',
      require('../panes/properties/PropertiesMultipleSelections'),
    ),
    // Tasks (property fields)
    bifrost.panes.getPaneViaPaneProvider(
      'bpmn/panes/properties/PropertiesServiceTask',
      'bpmn/pane-providers/properties/PropertiesServiceTask',
      require('../panes/properties/ServiceTask/PropertiesServiceTask'),
    ),
    bifrost.panes.getPaneViaPaneProvider(
      'bpmn/panes/properties/PropertiesReceiveTask',
      'bpmn/pane-providers/properties/PropertiesReceiveTask',
      require('../panes/properties/ReceiveTask/PropertiesReceiveTask'),
    ),
    bifrost.panes.getPaneViaPaneProvider(
      'bpmn/panes/properties/PropertiesSendTask',
      'bpmn/pane-providers/properties/PropertiesSendTask',
      require('../panes/properties/SendTask/PropertiesSendTask'),
    ),
    bifrost.panes.getPaneViaPaneProvider(
      'bpmn/panes/properties/PropertiesScriptTask',
      'bpmn/pane-providers/properties/PropertiesScriptTask',
      require('../panes/properties/ScriptTask/PropertiesScriptTask'),
    ),
    bifrost.panes.getPaneViaPaneProvider(
      'bpmn/panes/properties/PropertiesCallActivity',
      'bpmn/pane-providers/properties/PropertiesCallActivity',
      require('../panes/properties/CallActivity/PropertiesCallActivity'),
    ),
    bifrost.panes.getPaneViaPaneProvider(
      'bpmn/panes/properties/PropertiesManualTask',
      'bpmn/pane-providers/properties/PropertiesManualTask',
      require('../panes/properties/ManualTask/PropertiesManualTask'),
    ),
    bifrost.panes.getPaneViaPaneProvider(
      'bpmn/panes/properties/PropertiesBusinessRuleTask',
      'bpmn/pane-providers/properties/PropertiesBusinessRuleTask',
      require('../panes/properties/BusinessRuleTask/PropertiesBusinessRuleTask'),
    ),
    bifrost.panes.getPaneViaPaneProvider(
      'bpmn/panes/properties/PropertiesHttpTask',
      'bpmn/pane-providers/properties/PropertiesHttpTask',
      require('../panes/properties/ServiceTask/HttpTask/PropertiesHttpTask'),
    ),

    // User Task
    bifrost.panes.getPaneViaPaneProvider(
      'bpmn/panes/properties/PropertiesUserTask',
      'bpmn/pane-providers/properties/PropertiesUserTask',
      require('../panes/properties/UserTask/PropertiesUserTask'),
    ),
    bifrost.panes.getPaneViaPaneProvider(
      'bpmn/panes/properties/PropertiesUserTaskFormSummary',
      'bpmn/pane-providers/properties/PropertiesUserTaskFormSummary',
      require('../panes/properties/UserTask/PropertiesUserTaskFormSummary'),
    ),
    bifrost.panes.getPaneViaPaneProvider(
      'bpmn/panes/properties/PropertiesUserTaskAssignees',
      'bpmn/pane-providers/properties/PropertiesUserTaskAssignees',
      require('../panes/properties/UserTask/PropertiesUserTaskAssignees'),
    ),

    // Form Builder (field + action inspectors)
    bifrost.panes.getPaneViaPaneProvider(
      'bpmn/panes/properties/PropertiesFormBuilderField',
      'bpmn/pane-providers/properties/PropertiesFormBuilderField',
      require('../form-builder/panes/PropertiesFormBuilderField'),
    ),
    bifrost.panes.getPaneViaPaneProvider(
      'bpmn/panes/properties/PropertiesFormBuilderAction',
      'bpmn/pane-providers/properties/PropertiesFormBuilderAction',
      require('../form-builder/panes/PropertiesFormBuilderAction'),
    ),

    // Message events (message/signal reference fields)
    bifrost.panes.getPaneViaPaneProvider(
      'bpmn/panes/properties/PropertiesMessageBoundaryEvent',
      'bpmn/pane-providers/properties/PropertiesMessageBoundaryEvent',
      require('../panes/properties/MessageBoundaryEvent/PropertiesMessageBoundaryEvent'),
    ),
    bifrost.panes.getPaneViaPaneProvider(
      'bpmn/panes/properties/PropertiesMessageStartEvent',
      'bpmn/pane-providers/properties/PropertiesMessageStartEvent',
      require('../panes/properties/MessageStartEvent/PropertiesMessageStartEvent'),
    ),
    bifrost.panes.getPaneViaPaneProvider(
      'bpmn/panes/properties/PropertiesMessageEndEvent',
      'bpmn/pane-providers/properties/PropertiesMessageEndEvent',
      require('../panes/properties/MessageEndEvent/PropertiesMessageEndEvent'),
    ),
    bifrost.panes.getPaneViaPaneProvider(
      'bpmn/panes/properties/PropertiesMessageIntermediateThrowEvent',
      'bpmn/pane-providers/properties/PropertiesMessageIntermediateThrowEvent',
      require('../panes/properties/MessageIntermediateThrowEvent/PropertiesMessageIntermediateThrowEvent'),
    ),
    bifrost.panes.getPaneViaPaneProvider(
      'bpmn/panes/properties/PropertiesMessageIntermediateCatchEvent',
      'bpmn/pane-providers/properties/PropertiesMessageIntermediateCatchEvent',
      require('../panes/properties/MessageIntermediateCatchEvent/PropertiesMessageIntermediateCatchEvent'),
    ),

    // Signal events
    bifrost.panes.getPaneViaPaneProvider(
      'bpmn/panes/properties/PropertiesSignalBoundaryEvent',
      'bpmn/pane-providers/properties/PropertiesSignalBoundaryEvent',
      require('../panes/properties/SignalBoundaryEvent/PropertiesSignalBoundaryEvent'),
    ),
    bifrost.panes.getPaneViaPaneProvider(
      'bpmn/panes/properties/PropertiesSignalStartEvent',
      'bpmn/pane-providers/properties/PropertiesSignalStartEvent',
      require('../panes/properties/SignalStartEvent/PropertiesSignalStartEvent'),
    ),
    bifrost.panes.getPaneViaPaneProvider(
      'bpmn/panes/properties/PropertiesSignalEndEvent',
      'bpmn/pane-providers/properties/PropertiesSignalEndEvent',
      require('../panes/properties/SignalEndEvent/PropertiesSignalEndEvent'),
    ),
    bifrost.panes.getPaneViaPaneProvider(
      'bpmn/panes/properties/PropertiesSignalIntermediateThrowEvent',
      'bpmn/pane-providers/properties/PropertiesSignalIntermediateThrowEvent',
      require('../panes/properties/SignalIntermediateThrowEvent/PropertiesSignalIntermediateThrowEvent'),
    ),
    bifrost.panes.getPaneViaPaneProvider(
      'bpmn/panes/properties/PropertiesSignalIntermediateCatchEvent',
      'bpmn/pane-providers/properties/PropertiesSignalIntermediateCatchEvent',
      require('../panes/properties/SignalIntermediateCatchEvent/PropertiesSignalIntermediateCatchEvent'),
    ),

    // Error events
    bifrost.panes.getPaneViaPaneProvider(
      'bpmn/panes/properties/PropertiesErrorEndEvent',
      'bpmn/pane-providers/properties/PropertiesErrorEndEvent',
      require('../panes/properties/ErrorEndEvent/PropertiesErrorEndEvent'),
    ),
    bifrost.panes.getPaneViaPaneProvider(
      'bpmn/panes/properties/PropertiesErrorBoundaryEvent',
      'bpmn/pane-providers/properties/PropertiesErrorBoundaryEvent',
      require('../panes/properties/ErrorBoundaryEvent/PropertiesErrorBoundaryEvent'),
    ),
    bifrost.panes.getPaneViaPaneProvider(
      'bpmn/panes/properties/PropertiesErrorStartEvent',
      'bpmn/pane-providers/properties/PropertiesErrorStartEvent',
      require('../panes/properties/ErrorStartEvent/PropertiesErrorStartEvent'),
    ),

    // Escalation events
    bifrost.panes.getPaneViaPaneProvider(
      'bpmn/panes/properties/PropertiesEscalationBoundaryEvent',
      'bpmn/pane-providers/properties/PropertiesEscalationBoundaryEvent',
      require('../panes/properties/EscalationBoundaryEvent/PropertiesEscalationBoundaryEvent'),
    ),
    bifrost.panes.getPaneViaPaneProvider(
      'bpmn/panes/properties/PropertiesEscalationStartEvent',
      'bpmn/pane-providers/properties/PropertiesEscalationStartEvent',
      require('../panes/properties/EscalationStartEvent/PropertiesEscalationStartEvent'),
    ),
    bifrost.panes.getPaneViaPaneProvider(
      'bpmn/panes/properties/PropertiesEscalationIntermediateThrowEvent',
      'bpmn/pane-providers/properties/PropertiesEscalationIntermediateThrowEvent',
      require('../panes/properties/EscalationIntermediateThrowEvent/PropertiesEscalationIntermediateThrowEvent'),
    ),
    bifrost.panes.getPaneViaPaneProvider(
      'bpmn/panes/properties/PropertiesEscalationEndEvent',
      'bpmn/pane-providers/properties/PropertiesEscalationEndEvent',
      require('../panes/properties/EscalationEndEvent/PropertiesEscalationEndEvent'),
    ),

    // Compensation events
    bifrost.panes.getPaneViaPaneProvider(
      'bpmn/panes/properties/PropertiesCompensationBoundaryEvent',
      'bpmn/pane-providers/properties/PropertiesCompensationBoundaryEvent',
      require('../panes/properties/CompensationBoundaryEvent/PropertiesCompensationBoundaryEvent'),
    ),
    bifrost.panes.getPaneViaPaneProvider(
      'bpmn/panes/properties/PropertiesCompensationThrowEvent',
      'bpmn/pane-providers/properties/PropertiesCompensationThrowEvent',
      require('../panes/properties/CompensationThrowEvent/PropertiesCompensationThrowEvent'),
    ),

    // Conditional events
    bifrost.panes.getPaneViaPaneProvider(
      'bpmn/panes/properties/PropertiesConditionalStartEvent',
      'bpmn/pane-providers/properties/PropertiesConditionalStartEvent',
      require('../panes/properties/ConditionalStartEvent/PropertiesConditionalStartEvent'),
    ),
    bifrost.panes.getPaneViaPaneProvider(
      'bpmn/panes/properties/PropertiesConditionalBoundaryEvent',
      'bpmn/pane-providers/properties/PropertiesConditionalBoundaryEvent',
      require('../panes/properties/ConditionalBoundaryEvent/PropertiesConditionalBoundaryEvent'),
    ),
    bifrost.panes.getPaneViaPaneProvider(
      'bpmn/panes/properties/PropertiesConditionalIntermediateCatchEvent',
      'bpmn/pane-providers/properties/PropertiesConditionalIntermediateCatchEvent',
      require('../panes/properties/ConditionalIntermediateCatchEvent/PropertiesConditionalIntermediateCatchEvent'),
    ),

    // Timer events
    bifrost.panes.getPaneViaPaneProvider(
      'bpmn/panes/properties/PropertiesTimerStartEvent',
      'bpmn/pane-providers/properties/PropertiesTimerStartEvent',
      require('../panes/properties/TimerStartEvent/PropertiesTimerStartEvent'),
    ),
    bifrost.panes.getPaneViaPaneProvider(
      'bpmn/panes/properties/PropertiesTimerBoundaryEvent',
      'bpmn/pane-providers/properties/PropertiesTimerBoundaryEvent',
      require('../panes/properties/TimerBoundaryEvent/PropertiesTimerBoundaryEvent'),
    ),
    bifrost.panes.getPaneViaPaneProvider(
      'bpmn/panes/properties/PropertiesTimerIntermediateEvent',
      'bpmn/pane-providers/properties/PropertiesTimerIntermediateEvent',
      require('../panes/properties/TimerIntermediateEvent/PropertiesTimerIntermediateEvent'),
    ),

    // Link events
    bifrost.panes.getPaneViaPaneProvider(
      'bpmn/panes/properties/PropertiesLinkIntermediateThrowEvent',
      'bpmn/pane-providers/properties/PropertiesLinkIntermediateThrowEvent',
      require('../panes/properties/LinkIntermediateThrowEvent/PropertiesLinkIntermediateThrowEvent'),
    ),
    bifrost.panes.getPaneViaPaneProvider(
      'bpmn/panes/properties/PropertiesLinkIntermediateCatchEvent',
      'bpmn/pane-providers/properties/PropertiesLinkIntermediateCatchEvent',
      require('../panes/properties/LinkIntermediateCatchEvent/PropertiesLinkIntermediateCatchEvent'),
    ),

    // Conditional flow
    bifrost.panes.getPaneViaPaneProvider(
      'bpmn/panes/properties/PropertiesConditionalFlow',
      'bpmn/pane-providers/properties/PropertiesConditionalFlow',
      require('../panes/properties/ConditionalFlow/PropertiesConditionalFlow'),
    ),

    // Loop & Multi-Instance configuration
    bifrost.panes.getPaneViaPaneProvider(
      'bpmn/panes/properties/PropertiesLoop',
      'bpmn/pane-providers/properties/PropertiesLoop',
      require('../panes/properties/Loop/PropertiesLoop'),
    ),
    bifrost.panes.getPaneViaPaneProvider(
      'bpmn/panes/properties/PropertiesInstanceCount',
      'bpmn/pane-providers/properties/PropertiesInstanceCount',
      require('../panes/properties/MultiInstances/PropertiesInstanceCount'),
    ),
    bifrost.panes.getPaneViaPaneProvider(
      'bpmn/panes/properties/PropertiesCompletionCondition',
      'bpmn/pane-providers/properties/PropertiesCompletionCondition',
      require('../panes/properties/MultiInstances/PropertiesCompletionCondition'),
    ),
    bifrost.panes.getPaneViaPaneProvider(
      'bpmn/panes/properties/PropertiesInputCollection',
      'bpmn/pane-providers/properties/PropertiesInputCollection',
      require('../panes/properties/MultiInstances/PropertiesInputCollection'),
    ),
    bifrost.panes.getPaneViaPaneProvider(
      'bpmn/panes/properties/PropertiesOutputCollection',
      'bpmn/pane-providers/properties/PropertiesOutputCollection',
      require('../panes/properties/MultiInstances/PropertiesOutputCollection'),
    ),
    bifrost.panes.getPaneViaPaneProvider(
      'bpmn/panes/properties/PropertiesMultiInstanceExtensions',
      'bpmn/pane-providers/properties/PropertiesMultiInstanceExtensions',
      require('../panes/properties/MultiInstances/PropertiesMultiInstanceExtensions'),
    ),

    // Data Object
    bifrost.panes.getPaneViaPaneProvider(
      'bpmn/panes/properties/PropertiesDataObject',
      'bpmn/pane-providers/properties/PropertiesDataObject',
      require('../panes/properties/DataObject/PropertiesDataObject'),
    ),

    // Other
    bifrost.panes.getPaneViaPaneProvider(
      'bpmn/panes/properties/PropertiesTextAnnotation',
      'bpmn/pane-providers/properties/PropertiesTextAnnotation',
      require('../panes/properties/TextAnnotation/PropertiesTextAnnotation'),
    ),
    bifrost.panes.getPaneViaPaneProvider(
      'bpmn/panes/properties/PropertiesGroup',
      'bpmn/pane-providers/properties/PropertiesGroup',
      require('../panes/properties/Group/PropertiesGroup'),
    ),
  ]);

  bifrost.panes.prependToPaneGroup('right', 'scripting', [
    bifrost.panes.getPaneViaPaneProvider(
      'bpmn/panes/properties/PropertiesDataOutputAssociationDataSource',
      'bpmn/pane-providers/properties/PropertiesDataOutputAssociationDataSource',
      require('../panes/properties/DataOutputAssociation/PropertiesDataOutputAssociationDataSource'),
    ),
    bifrost.panes.getPaneViaPaneProvider(
      'bpmn/panes/properties/PropertiesInputMappings',
      'bpmn/pane-providers/properties/PropertiesInputMappings',
      require('../panes/properties/DataPipeline/PropertiesInputMappings'),
    ),
    bifrost.panes.getPaneViaPaneProvider(
      'bpmn/panes/properties/PropertiesOutputMappings',
      'bpmn/pane-providers/properties/PropertiesOutputMappings',
      require('../panes/properties/DataPipeline/PropertiesOutputMappings'),
    ),
    bifrost.panes.getPaneViaPaneProvider(
      'bpmn/panes/properties/PropertiesCorrelationRetrievalExpression',
      'bpmn/pane-providers/properties/PropertiesCorrelationRetrievalExpression',
      require('../panes/properties/MessageCorrelation/PropertiesCorrelationRetrievalExpression'),
    ),
    bifrost.panes.getPaneViaPaneProvider(
      'bpmn/panes/properties/PropertiesPayloadContract',
      'bpmn/pane-providers/properties/PropertiesPayloadContract',
      require('../panes/properties/DataPipeline/PropertiesPayloadContract'),
    ),
    bifrost.panes.getPaneViaPaneProvider(
      'bpmn/panes/properties/PropertiesResultContract',
      'bpmn/pane-providers/properties/PropertiesResultContract',
      require('../panes/properties/DataPipeline/PropertiesResultContract'),
    ),
    bifrost.panes.getPaneViaPaneProvider(
      'bpmn/panes/properties/DefaultCustomStartToken',
      'bpmn/pane-providers/properties/DefaultCustomStartToken',
      require('../panes/properties/DefaultCustomStartToken/PropertiesDefaultCustomStartToken'),
    ),
    bifrost.panes.getPaneViaPaneProvider(
      'bpmn/panes/properties/PropertiesExamplePayload',
      'bpmn/pane-providers/properties/PropertiesExamplePayload',
      require('../panes/properties/ExamplePayload/PropertiesExamplePayload'),
    ),
    bifrost.panes.getPaneViaPaneProvider(
      'bpmn/panes/properties/PropertiesExampleResult',
      'bpmn/pane-providers/properties/PropertiesExampleResult',
      require('../panes/properties/ExampleResult/PropertiesExampleResult'),
    ),
    bifrost.panes.getPaneViaPaneProvider(
      'bpmn/panes/PropertiesCustomAttributes',
      'bpmn/pane-providers/PropertiesCustomAttributes',
      require('../panes/properties/PropertiesCustomAttributes'),
    ),
  ]);

  bifrost.panes.prependToPaneGroup('right', 'documentation', [
    bifrost.panes.getPaneViaPaneProvider(
      'bpmn/panes/properties/PropertiesElementDocumentation',
      'bpmn/pane-providers/properties/PropertiesElementDocumentation',
      require('../panes/properties/PropertiesElementDocumentation'),
    ),
  ]);
}

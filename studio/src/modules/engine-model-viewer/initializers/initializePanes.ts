import type { Bifrost } from '#bifrost/Bifrost';

import * as BusinessRuleTaskPane from '../panes/BusinessRuleTaskPane';
import * as CallActivityPane from '../panes/CallActivityPane';
import * as ConditionalEventPane from '../panes/ConditionalEventPane';
import * as CorrelationRetrievalExpressionPane from '../panes/CorrelationRetrievalExpressionPane';
import * as DataObjectPane from '../panes/DataObjectPane';
import * as DocumentationPane from '../panes/DocumentationPane';
import * as ElementIdentityPane from '../panes/ElementIdentityPane';
import * as ErrorEventPane from '../panes/ErrorEventPane';
import * as EscalationEventPane from '../panes/EscalationEventPane';
import * as GatewayPane from '../panes/GatewayPane';
import * as InputMappingsPane from '../panes/InputMappingsPane';
import * as LinkEventPane from '../panes/LinkEventPane';
import * as ManualTaskPane from '../panes/ManualTaskPane';
import * as MessageEventPane from '../panes/MessageEventPane';
import * as MultiInstancePane from '../panes/MultiInstancePane';
import * as OutputMappingsPane from '../panes/OutputMappingsPane';
import * as PayloadContractPane from '../panes/PayloadContractPane';
import * as ProcessDefinitionInfoPane from '../panes/ProcessDefinitionInfoPane';
import * as ReceiveTaskPane from '../panes/ReceiveTaskPane';
import * as ResultContractPane from '../panes/ResultContractPane';
import * as ScriptTaskPane from '../panes/ScriptTaskPane';
import * as SendTaskPane from '../panes/SendTaskPane';
import * as SequenceFlowPane from '../panes/SequenceFlowPane';
import * as ServiceTaskPane from '../panes/ServiceTaskPane';
import * as SignalEventPane from '../panes/SignalEventPane';
import * as SubProcessPane from '../panes/SubProcessPane';
import * as SubprocessContextPane from '../panes/SubprocessContextPane';
import * as TimerEventPane from '../panes/TimerEventPane';
import * as UserTaskPane from '../panes/UserTaskPane';

export default function initializePanes(bifrost: Bifrost): void {
  registerPropertyPanes(bifrost);
  registerScriptingPanes(bifrost);
  registerDocumentationPanes(bifrost);
}

function registerPropertyPanes(bifrost: Bifrost): void {
  bifrost.panes.prependToPaneGroup('right', 'property', [
    bifrost.panes.getPaneViaPaneProvider(
      'engine-model-viewer/panes/ProcessDefinitionInfo',
      'engine-model-viewer/pane-providers/ProcessDefinitionInfo',
      ProcessDefinitionInfoPane,
    ),
    bifrost.panes.getPaneViaPaneProvider(
      'engine-model-viewer/panes/SubprocessContext',
      'engine-model-viewer/pane-providers/SubprocessContext',
      SubprocessContextPane,
    ),
    bifrost.panes.getPaneViaPaneProvider(
      'engine-model-viewer/panes/ElementIdentity',
      'engine-model-viewer/pane-providers/ElementIdentity',
      ElementIdentityPane,
    ),

    bifrost.panes.getPaneViaPaneProvider(
      'engine-model-viewer/panes/UserTask',
      'engine-model-viewer/pane-providers/UserTask',
      UserTaskPane,
    ),
    bifrost.panes.getPaneViaPaneProvider(
      'engine-model-viewer/panes/ServiceTask',
      'engine-model-viewer/pane-providers/ServiceTask',
      ServiceTaskPane,
    ),
    bifrost.panes.getPaneViaPaneProvider(
      'engine-model-viewer/panes/ScriptTask',
      'engine-model-viewer/pane-providers/ScriptTask',
      ScriptTaskPane,
    ),
    bifrost.panes.getPaneViaPaneProvider(
      'engine-model-viewer/panes/BusinessRuleTask',
      'engine-model-viewer/pane-providers/BusinessRuleTask',
      BusinessRuleTaskPane,
    ),
    bifrost.panes.getPaneViaPaneProvider(
      'engine-model-viewer/panes/ManualTask',
      'engine-model-viewer/pane-providers/ManualTask',
      ManualTaskPane,
    ),
    bifrost.panes.getPaneViaPaneProvider(
      'engine-model-viewer/panes/SendTask',
      'engine-model-viewer/pane-providers/SendTask',
      SendTaskPane,
    ),
    bifrost.panes.getPaneViaPaneProvider(
      'engine-model-viewer/panes/ReceiveTask',
      'engine-model-viewer/pane-providers/ReceiveTask',
      ReceiveTaskPane,
    ),
    bifrost.panes.getPaneViaPaneProvider(
      'engine-model-viewer/panes/CallActivity',
      'engine-model-viewer/pane-providers/CallActivity',
      CallActivityPane,
    ),
    bifrost.panes.getPaneViaPaneProvider(
      'engine-model-viewer/panes/Gateway',
      'engine-model-viewer/pane-providers/Gateway',
      GatewayPane,
    ),
    bifrost.panes.getPaneViaPaneProvider(
      'engine-model-viewer/panes/SubProcess',
      'engine-model-viewer/pane-providers/SubProcess',
      SubProcessPane,
    ),
    bifrost.panes.getPaneViaPaneProvider(
      'engine-model-viewer/panes/MultiInstance',
      'engine-model-viewer/pane-providers/MultiInstance',
      MultiInstancePane,
    ),

    bifrost.panes.getPaneViaPaneProvider(
      'engine-model-viewer/panes/SequenceFlow',
      'engine-model-viewer/pane-providers/SequenceFlow',
      SequenceFlowPane,
    ),

    bifrost.panes.getPaneViaPaneProvider(
      'engine-model-viewer/panes/TimerEvent',
      'engine-model-viewer/pane-providers/TimerEvent',
      TimerEventPane,
    ),
    bifrost.panes.getPaneViaPaneProvider(
      'engine-model-viewer/panes/MessageEvent',
      'engine-model-viewer/pane-providers/MessageEvent',
      MessageEventPane,
    ),
    bifrost.panes.getPaneViaPaneProvider(
      'engine-model-viewer/panes/SignalEvent',
      'engine-model-viewer/pane-providers/SignalEvent',
      SignalEventPane,
    ),
    bifrost.panes.getPaneViaPaneProvider(
      'engine-model-viewer/panes/ErrorEvent',
      'engine-model-viewer/pane-providers/ErrorEvent',
      ErrorEventPane,
    ),
    bifrost.panes.getPaneViaPaneProvider(
      'engine-model-viewer/panes/EscalationEvent',
      'engine-model-viewer/pane-providers/EscalationEvent',
      EscalationEventPane,
    ),
    bifrost.panes.getPaneViaPaneProvider(
      'engine-model-viewer/panes/ConditionalEvent',
      'engine-model-viewer/pane-providers/ConditionalEvent',
      ConditionalEventPane,
    ),
    bifrost.panes.getPaneViaPaneProvider(
      'engine-model-viewer/panes/LinkEvent',
      'engine-model-viewer/pane-providers/LinkEvent',
      LinkEventPane,
    ),

    bifrost.panes.getPaneViaPaneProvider(
      'engine-model-viewer/panes/DataObject',
      'engine-model-viewer/pane-providers/DataObject',
      DataObjectPane,
    ),
  ]);
}

function registerScriptingPanes(bifrost: Bifrost): void {
  bifrost.panes.prependToPaneGroup('right', 'scripting', [
    bifrost.panes.getPaneViaPaneProvider(
      'engine-model-viewer/panes/InputMappings',
      'engine-model-viewer/pane-providers/InputMappings',
      InputMappingsPane,
    ),
    bifrost.panes.getPaneViaPaneProvider(
      'engine-model-viewer/panes/OutputMappings',
      'engine-model-viewer/pane-providers/OutputMappings',
      OutputMappingsPane,
    ),
    bifrost.panes.getPaneViaPaneProvider(
      'engine-model-viewer/panes/CorrelationRetrievalExpression',
      'engine-model-viewer/pane-providers/CorrelationRetrievalExpression',
      CorrelationRetrievalExpressionPane,
    ),
    bifrost.panes.getPaneViaPaneProvider(
      'engine-model-viewer/panes/PayloadContract',
      'engine-model-viewer/pane-providers/PayloadContract',
      PayloadContractPane,
    ),
    bifrost.panes.getPaneViaPaneProvider(
      'engine-model-viewer/panes/ResultContract',
      'engine-model-viewer/pane-providers/ResultContract',
      ResultContractPane,
    ),
  ]);
}

function registerDocumentationPanes(bifrost: Bifrost): void {
  bifrost.panes.prependToPaneGroup('right', 'documentation', [
    bifrost.panes.getPaneViaPaneProvider(
      'engine-model-viewer/panes/Documentation',
      'engine-model-viewer/pane-providers/Documentation',
      DocumentationPane,
    ),
  ]);
}

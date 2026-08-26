import { assertNotNull } from '#bifrost/common/AssertionFunctions';
import type { EditorDocument } from '#bifrost/contracts/EditorTypes';
import type { PaneComponentProps, PaneProvider } from '#bifrost/contracts/PaneTypes';
import { Pane } from '#components/panes/Pane';
import { PaneBody } from '#components/panes/PaneBody';
import { PaneHeader } from '#components/panes/PaneHeader';
import { PaneHeaderHelpIcon } from '#components/panes/PaneHeaderHelpIcon';
import { BpmnElementType } from '#modules/bpmn-editor/BpmnElementTypes';
import { LoopCharacteristics } from '#modules/bpmn-editor/BpmnElementTypes';

import React from 'react';

import type BpmnDocumentModel from '../../BpmnDocumentModel';
import { BPMN_DOCUMENT_TYPE } from '../../index';
import { getLoopCharacteristicType } from '../PropertiesPaneFunctions';

type ElementInfoEntry = {
  title: string;
  description: string;
  helpId: string;
};

const elementInfoMap: Record<string, ElementInfoEntry> = {
  [BpmnElementType.ExclusiveGateway]: {
    title: 'Exclusive Gateway',
    description:
      'Exclusive Gateways take the process to a specific direction, based on a set of conditions. You can configure the condition of each outgoing sequence flow, by clicking on it.',
    helpId: 'bpmn/properties/exclusive_gateway',
  },
  [BpmnElementType.ParallelGateway]: {
    title: 'Parallel Gateway',
    description:
      'The parallel gateway splits a path into a number of new paths. All divergent paths must be merged back with a parallel gateway. The joining parallel gateway waits for all incoming paths to arrive.',
    helpId: 'bpmn/properties/parallel_gateway',
  },
  [BpmnElementType.InclusiveGateway]: {
    title: 'Inclusive Gateway',
    description:
      'Inclusive Gateways are a mix of Exclusive Gateways and Parallel Gateways. They can be used to model a decision where multiple paths can be taken in parallel.',
    helpId: 'bpmn/properties/inclusive_gateway',
  },
  [BpmnElementType.ComplexGateway]: {
    title: 'Complex Gateway',
    description:
      'A Complex Gateway is either a conditional split (every outgoing flow must be conditional or the default) or a single-fire threshold join that fires when its FEEL activation condition becomes true. These semantics are engine-specific and not portable BPMN.',
    helpId: 'bpmn/properties/complex_gateway',
  },
  [BpmnElementType.EventBasedGateway]: {
    title: 'Event Based Gateway',
    description:
      'Event Based Gateways take the process to a specific direction, based on a set of connected catch events.',
    helpId: 'bpmn/properties/event_based_gateway',
  },
  [BpmnElementType.StartEvent]: {
    title: 'Start Event',
    description:
      'A start event is used to represent the start of a process path. Each process must contain at least one start event. There are several types of start events.',
    helpId: 'bpmn/properties/start_event',
  },
  [BpmnElementType.EndEvent]: {
    title: 'End Event',
    description:
      'An end event is used to represent the end of a path. Each process must contain at least one end event. There are several types of end events.',
    helpId: 'bpmn/properties/end_event',
  },
  [BpmnElementType.IntermediateEvent]: {
    title: 'Intermediate Event',
    description:
      'An intermediate event is used to catch or throw something, e.g. a message. There are several types of intermediate events.',
    helpId: 'bpmn/properties/intermediate_event',
  },
  [BpmnElementType.BoundaryEvent]: {
    title: 'Boundary Event',
    description:
      'A boundary event is attached to a task and used to catch events from the task e.g. an error event. There are several types of boundary events.',
    helpId: 'bpmn/properties/boundary_event',
  },
  [BpmnElementType.TerminateEndEvent]: {
    title: 'Terminate End Event',
    description:
      'The Termination End Event is a specialized End Event that is designed to immediately end the Process and all containing flow node instances.',
    helpId: 'bpmn/properties/terminate_end_event',
  },
  [BpmnElementType.CancelEndEvent]: {
    title: 'Cancel End Event',
    description:
      'The Cancel End Event is a specialized End Event that is designed to cancel a Transaction Sub-Process.',
    helpId: 'bpmn/properties/cancel_end_event',
  },
  [BpmnElementType.CancelBoundaryEvent]: {
    title: 'Cancel Boundary Event',
    description:
      'The Cancel Boundary Event is a specialized Boundary Event that is triggered if a Cancel Event is triggered in the Transaction Sub-Process.',
    helpId: 'bpmn/properties/cancel_boundary_event',
  },
  [BpmnElementType.CompensationStartEvent]: {
    title: 'Compensation Start Event',
    description:
      'The Compensation Start Event is a specialized Start Event that is triggered by a Compensation Event from another Process or Participant respectively.',
    helpId: 'bpmn/properties/compensation_start_event',
  },
  [BpmnElementType.CompensationIntermediateThrowEvent]: {
    title: 'Compensation Intermediate Throw Event',
    description:
      'The Compensation Intermediate Throw Event is a specialized Intermediate Event that indicates that a Compensation is necessary.',
    helpId: 'bpmn/properties/compensation_intermediate_throw_event',
  },
  [BpmnElementType.CompensationEndEvent]: {
    title: 'Compensation End Event',
    description:
      'The Compensation End Event is a specialized End Event that indicates that a Compensation is necessary.',
    helpId: 'bpmn/properties/compensation_end_event',
  },
  [BpmnElementType.CompensationBoundaryEvent]: {
    title: 'Compensation Boundary Event',
    description:
      'The Compensation Boundary Event is a specialized Boundary Event that is triggered if a Compensation Event is triggered in the process.',
    helpId: 'bpmn/properties/compensation_boundary_event',
  },
  [BpmnElementType.Subprocess]: {
    title: 'Subprocess',
    description: 'A Subprocess is defined inside a parent process.',
    helpId: 'bpmn/properties/subprocess',
  },
  [BpmnElementType.Transaction]: {
    title: 'Transaction',
    description:
      'Transactions are used to facilitate processes with complex interdependencies and/or very long runtimes.',
    helpId: 'bpmn/properties/transaction',
  },
  [BpmnElementType.EventSubprocess]: {
    title: 'Event Subprocess',
    description:
      'An Event Subprocess is a specialized Subprocess that is triggered by an event. The triggering event is modeled as a Start Event.',
    helpId: 'bpmn/properties/event_subprocess',
  },
  [BpmnElementType.AdHocSubprocess]: {
    title: 'Ad-hoc Sub-Process',
    description:
      'An Ad-hoc Sub-Process is an unstructured "menu" of activities that can be activated in any order (or in a defined sequence), instead of following a fixed sequence flow.',
    helpId: 'bpmn/properties/adhoc_subprocess',
  },
  [BpmnElementType.ManualTask]: {
    title: 'Manual Task',
    description: 'A manual task is used to represent work that has to be performed and confirmed by a human.',
    helpId: 'bpmn/properties/manual_task',
  },
  [BpmnElementType.UntypedTask]: {
    title: 'Untyped Task',
    description:
      'Untyped tasks can be used to model the overall structure of a process, before making it more specific.',
    helpId: 'bpmn/properties/untyped_task',
  },
  [BpmnElementType.DataObject]: {
    title: 'Data Object',
    description: 'Data Objects present a simple way of storing data for a process instance globally.',
    helpId: 'bpmn/properties/data_object',
  },
  [BpmnElementType.DataInputAssociation]: {
    title: 'Data Input Association',
    description: 'This is a Data Input Association from a Data Object to a Flow Node (event or task).',
    helpId: 'bpmn/properties/data_input_association',
  },
  [BpmnElementType.DataOutputAssociation]: {
    title: 'Data Output Association',
    description: 'This is a Data Output Association from a Flow Node (event or task) to a Data Object.',
    helpId: 'bpmn/properties/data_output_association',
  },
  [BpmnElementType.DataStore]: {
    title: 'Data Store',
    description: 'Data Stores symbolize a data source that exists in an external system, outside of the engine.',
    helpId: 'bpmn/properties/data_store',
  },
  [BpmnElementType.SequenceFlow]: {
    title: 'Sequence Flow',
    description: 'A sequence flow is used to connect flow objects in a process.',
    helpId: 'bpmn/properties/sequence_flow',
  },
  [BpmnElementType.DefaultFlow]: {
    title: 'Default Flow',
    description: 'Default Flows can be used as fallback if no condition matches.',
    helpId: 'bpmn/properties/default_flow',
  },
  [BpmnElementType.MessageFlow]: {
    title: 'Message Flow',
    description: 'The Message Flow is a specialized flow that describes the target of a Message.',
    helpId: 'bpmn/properties/message_flow',
  },
  [BpmnElementType.UserTask]: {
    title: 'User Task',
    description: 'A user task represents work that needs to be performed by a human.',
    helpId: 'bpmn/properties/user_task',
  },
  [BpmnElementType.BusinessRuleTask]: {
    title: 'Business Rule Task',
    description: 'A Business Rule Task is used to execute one or more business rules.',
    helpId: 'bpmn/properties/business_rule_task',
  },
  [BpmnElementType.SignalEndEvent]: {
    title: 'Signal End Event',
    description:
      'The Signal End Event is a specialized End Event that is used to finish a process and trigger a Signal Event.',
    helpId: 'bpmn/properties/signal_end_event',
  },
  [BpmnElementType.ErrorEndEvent]: {
    title: 'Error End Event',
    description: 'The Error End Event is a specialized End Event that finishes a Process with an error.',
    helpId: 'bpmn/properties/error_end_event',
  },
  [BpmnElementType.MessageEndEvent]: {
    title: 'Message End Event',
    description:
      'The Message End Event is a specialized End Event that is used to finish a process and trigger a Message Event.',
    helpId: 'bpmn/properties/message_end_event',
  },
  [BpmnElementType.CallActivity]: {
    title: 'Call Activity',
    description:
      'A Call Activity invokes another process as part of the current process. It references a target process by its ID.',
    helpId: 'bpmn/properties/call_activity',
  },
  [BpmnElementType.ScriptTask]: {
    title: 'Script Task',
    description:
      'A Script Task is a task that executes a script when it is activated. The script is defined directly in the task.',
    helpId: 'bpmn/properties/script_task',
  },
  [BpmnElementType.ServiceTask]: {
    title: 'Service Task',
    description:
      'A Service Task is used to invoke an automated service. Configure its implementation type in the Properties pane.',
    helpId: 'bpmn/properties/service_task',
  },
  [BpmnElementType.HttpServiceTask]: {
    title: 'HTTP Service Task',
    description: 'An HTTP Service Task sends an HTTP request to a specified URL when activated.',
    helpId: 'bpmn/properties/http_service_task',
  },
  [BpmnElementType.SendTask]: {
    title: 'Send Task',
    description: 'A Send Task is used to send a message to an external participant or process.',
    helpId: 'bpmn/properties/send_task',
  },
  [BpmnElementType.ReceiveTask]: {
    title: 'Receive Task',
    description: 'A Receive Task waits for the arrival of a specific message before continuing.',
    helpId: 'bpmn/properties/receive_task',
  },
};

const PARALLEL_MI_INFO: ElementInfoEntry = {
  title: 'Parallel Multi Instance',
  description: 'A parallel multi instance is used to process a list of values in parallel.',
  helpId: 'bpmn/properties/parallel-multi-instance',
};

const SEQUENTIAL_MI_INFO: ElementInfoEntry = {
  title: 'Sequential Multi Instance',
  description: 'A sequential multi instance processes a list of values one after another.',
  helpId: 'bpmn/properties/sequential-multi-instance',
};

const STANDARD_LOOP_INFO: ElementInfoEntry = {
  title: 'Standard Loop',
  description: 'A standard loop repeats a single activity while a condition holds.',
  helpId: 'bpmn/properties/loop',
};

function getInfoForElement(editorDocumentModel: any, elementType: string | undefined): ElementInfoEntry | undefined {
  if (elementType == null) {
    return undefined;
  }

  const loopType = getLoopCharacteristicType(editorDocumentModel);
  if (loopType === LoopCharacteristics.Parallel) {
    return PARALLEL_MI_INFO;
  }
  if (loopType === LoopCharacteristics.Sequential) {
    return SEQUENTIAL_MI_INFO;
  }
  if (loopType === LoopCharacteristics.Loop) {
    return STANDARD_LOOP_INFO;
  }

  return elementInfoMap[elementType];
}

export const paneProvider: PaneProvider = {
  getPaneTitle: getPaneTitle,
  shouldBeDisplayed: shouldBeDisplayed,
  Pane: PaneFull,
  PaneContent: PaneContent,
};

function getPaneTitle(): string {
  return 'General';
}

function shouldBeDisplayed(editorDocument: EditorDocument, editorDocumentModel: any): boolean {
  if (editorDocument?.documentType !== BPMN_DOCUMENT_TYPE) {
    return false;
  }

  const selectedElements = (editorDocumentModel as BpmnDocumentModel)?.selection?.getElements();
  if (selectedElements?.length !== 1) {
    return false;
  }

  return getInfoForElement(editorDocumentModel, selectedElements[0]?.type) != null;
}

function PaneFull(props: PaneComponentProps): React.JSX.Element {
  const bpmnDocumentModel: BpmnDocumentModel | null = props.editorDocumentModel;
  const element = bpmnDocumentModel?.selection?.getOnlyElementOrNull();
  const info = getInfoForElement(props.editorDocumentModel, element?.type);
  const title = info?.title ?? getPaneTitle();

  return (
    <Pane>
      <PaneHeader studio={props.studio} title={title} paneId={props.paneId} collapsed={props.collapsed}>
        {info && <PaneHeaderHelpIcon studio={props.studio} id={info.helpId} />}
      </PaneHeader>
      {props.collapsed !== true && <PaneContent {...props} />}
    </Pane>
  );
}

function PaneContent(props: PaneComponentProps): React.JSX.Element | null {
  const cmd = props.studio.commands.getClickHandler();
  const bpmnDocumentModel: BpmnDocumentModel | null = props.editorDocumentModel;
  assertNotNull(bpmnDocumentModel, 'bpmnDocumentModel');

  const element = bpmnDocumentModel.selection.getOnlyElementOrNull();
  assertNotNull(element, 'element');

  const info = getInfoForElement(props.editorDocumentModel, element.type);
  assertNotNull(info, 'info');

  return (
    <PaneBody>
      <span>
        {info.description}{' '}
        <a href="#" onClick={cmd('std.help.open', [info.helpId])}>
          Learn more ...
        </a>
      </span>
    </PaneBody>
  );
}

import type { Bifrost } from '#bifrost/Bifrost';
import type { EditorDocumentModel } from '#bifrost/common/EditorDocumentModel';
import type { EditorDocument } from '#bifrost/contracts/EditorTypes';
import type { PaneComponentProps, PaneProvider } from '#bifrost/contracts/PaneTypes';
import { LabelWithFeelExpressionHint } from '#components/FeelExpressionHint';
import { Pane } from '#components/panes/Pane';
import { PaneBody } from '#components/panes/PaneBody';
import { PaneHeader } from '#components/panes/PaneHeader';
import { PaneHeaderHelpIcon } from '#components/panes/PaneHeaderHelpIcon';
import { BpmnElementType } from '#modules/bpmn-editor/BpmnElementTypes';
import type { BpmnElement_TimerIntermediateEvent } from '#modules/bpmn-editor/BpmnElementTypes';
import { BpmnTimerType } from '#modules/bpmn-editor/BpmnElementTypes';

import React from 'react';

import type { SelectOption } from '@evil/bifrost_fw_sdk';
import { PaneProperty } from '@evil/bifrost_fw_sdk';

import type BpmnDocumentModel from '../../../BpmnDocumentModel';
import { assertBpmnElementIsTimerIntermediateEvent } from '../../BpmnElementTypeAssertionFunctions';
import {
  getBpmnSelectionForPropertiesPane,
  getKeyForPropertiesPane,
  shouldBeDisplayedForBpmnElementOfType,
} from '../../PropertiesPaneFunctions';

type TimerToUpdate = TimerToUpdate_TimerDefinition | TimerToUpdate_TimerType;

type TimerToUpdate_TimerDefinition = {
  timerDefinition: string;
};

type TimerToUpdate_TimerType = {
  timerType: string;
};

type TimerIntermediateEventDefinitionProps = {
  element: BpmnElement_TimerIntermediateEvent;
  onChange: (value: string) => void;
  cmd: (commandName: string, commandArgs?: any[]) => (event: any) => void;
  studio: Bifrost;
};

type DefinitionPropertyProps = TimerIntermediateEventDefinitionProps & {
  placeholder?: string;
};

export const paneProvider: PaneProvider = {
  getPaneTitle: getPaneTitle,
  shouldBeDisplayed: shouldBeDisplayed,
  Pane: PaneFull,
  PaneContent: PaneContent,
};

const TIMER_INTERMEDIATE_EVENT_HELP_ID = 'bpmn/properties/timer_intermediate_event';
const TIMER_INTERMEDIATE_EVENT_DATE_HELP_ID = 'bpmn/properties/timer_intermediate_event_date';
const TIMER_INTERMEDIATE_EVENT_DURATION_HELP_ID = 'bpmn/properties/timer_intermediate_event_duration';

function getPaneTitle(): string {
  return 'Timer Intermediate Event';
}

function PaneFull(props: PaneComponentProps): React.JSX.Element {
  return (
    <Pane>
      <PaneHeader studio={props.studio} title={getPaneTitle()} paneId={props.paneId} collapsed={props.collapsed}>
        <PaneHeaderHelpIcon studio={props.studio} id={TIMER_INTERMEDIATE_EVENT_HELP_ID} />
      </PaneHeader>
      {props.collapsed !== true && <PaneContent {...props} />}
    </Pane>
  );
}

function shouldBeDisplayed(
  editorDocument: EditorDocument,
  editorDocumentModel: EditorDocumentModel,
  studio: Bifrost,
): boolean {
  return shouldBeDisplayedForBpmnElementOfType(
    editorDocument,
    editorDocumentModel,
    BpmnElementType.TimerIntermediateEvent,
  );
}

function PaneContent(props: PaneComponentProps): React.JSX.Element | null {
  const selection = getBpmnSelectionForPropertiesPane(props);
  if (selection == null) {
    return null;
  }
  return <PropertiesTimerIntermediateEvent key={getKeyForPropertiesPane(selection)} {...props} />;
}

const selectOptions: SelectOption[] = [
  { value: BpmnTimerType.Date, label: 'Date' },
  { value: BpmnTimerType.Duration, label: 'Duration' },
];

function PropertiesTimerIntermediateEvent(props: PaneComponentProps): React.JSX.Element {
  const cmd = props.studio.commands.getClickHandler();
  const bpmnDocumentModel: BpmnDocumentModel = props.editorDocumentModel;

  const element = bpmnDocumentModel.selection.getOnlyElementOrNull();
  assertBpmnElementIsTimerIntermediateEvent(element);

  const initialValue = selectOptions.find((option) => option.value === element.timerType);

  const updateTimer = (newTimer: TimerToUpdate): void => {
    bpmnDocumentModel.elements.setElementProperty(element.id, 'timer', newTimer);
  };

  const changeDefinition = (newValue: string): void => {
    updateTimer({ timerDefinition: newValue });
  };

  const changeType = (newValue: string): void => {
    updateTimer({
      timerType: newValue,
      timerDefinition: undefined,
    });
  };

  return (
    <PaneBody key={`element_timer_type_${element.timerType}`}>
      <PaneProperty
        htmlId="timer-intermediate-event-select"
        label="Type"
        type="select"
        value={initialValue}
        onChange={(newValue: any) => changeType(newValue.value)}
        options={selectOptions}
      />

      <TimerIntermediateEventDefinition element={element} onChange={changeDefinition} cmd={cmd} studio={props.studio} />
    </PaneBody>
  );
}

function TimerIntermediateEventDefinition(props: TimerIntermediateEventDefinitionProps): React.JSX.Element | null {
  const timerType = props.element.timerType;
  switch (timerType) {
    case BpmnTimerType.Date:
      return <TimerIntermediateEventDateDefinition {...props} />;
    case BpmnTimerType.Duration:
      return <TimerIntermediateEventDurationDefinition {...props} />;
    default:
      return null;
  }
}

function TimerIntermediateEventDateDefinition(props: TimerIntermediateEventDefinitionProps): React.JSX.Element {
  return (
    <div className="form-group">
      <DefinitionProperty {...props} placeholder="YYYY-MM-DD HH:MM" />
      <small>
        Provide a date-time to define the execution time e.g. 2022-12-24, 12:12.
        <a href="#" onClick={props.cmd('std.help.open', [TIMER_INTERMEDIATE_EVENT_DATE_HELP_ID])}>
          Learn more ...
        </a>
      </small>
    </div>
  );
}

function TimerIntermediateEventDurationDefinition(props: TimerIntermediateEventDefinitionProps): React.JSX.Element {
  return (
    <>
      <DefinitionProperty {...props} placeholder="e.g. PT5S" />
      <small>
        Use the ISO 8601 duration standard to define durations, e.g. PT5S to wait 5 seconds.{' '}
        <a href="#" onClick={props.cmd('std.help.open', [TIMER_INTERMEDIATE_EVENT_DURATION_HELP_ID])}>
          Learn more ...
        </a>
      </small>
    </>
  );
}

function DefinitionProperty(props: DefinitionPropertyProps): React.JSX.Element {
  return (
    <PaneProperty
      key={`element_timer_definition_${props.element.timerDefinition}`}
      htmlId="timer-intermediate-event-definition-input"
      label={<LabelWithFeelExpressionHint studio={props.studio} label="Definition" />}
      type="text"
      value={props.element.timerDefinition}
      onCommit={(value: string) => props.onChange(value)}
      placeholder={props.placeholder}
    />
  );
}

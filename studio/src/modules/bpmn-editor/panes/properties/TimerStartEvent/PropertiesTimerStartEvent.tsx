import React from 'react';

import type {
  EditorDocument,
  EditorDocumentModel,
  PaneComponentProps,
  PaneProvider,
  SelectOption,
  Studio,
} from '@evil/bifrost_fw_sdk';
import {
  BpmnElementType,
  Checkbox,
  LabelWithFeelExpressionHint,
  Pane,
  PaneBody,
  PaneHeader,
  PaneHeaderHelpIcon,
  PaneProperty,
} from '@evil/bifrost_fw_sdk';
import type { BpmnElement_TimerStartEvent } from '@evil/bifrost_fw_sdk/types/bpmn/BpmnElementTypes';
import { BpmnTimerType } from '@evil/bifrost_fw_sdk/types/bpmn/BpmnElementTypes';

import type BpmnDocumentModel from '../../../BpmnDocumentModel';
import { assertBpmnElementIsTimerStartEvent } from '../../BpmnElementTypeAssertionFunctions';
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

type TimerStartEventDefinitionProps = {
  element: BpmnElement_TimerStartEvent;
  onChange: (value: string) => void;
  cmd: (commandName: string, commandArgs?: any[]) => (event: any) => void;
  studio: Studio;
};

type DefinitionPropertyProps = TimerStartEventDefinitionProps & {
  placeholder?: string;
};

export const paneProvider: PaneProvider = {
  getPaneTitle: getPaneTitle,
  shouldBeDisplayed: shouldBeDisplayed,
  Pane: PaneFull,
  PaneContent: PaneContent,
};

const TIMER_START_EVENT_HELP_ID = 'bpmn/properties/timer_start_event';
const TIMER_START_EVENT_CYCLE_HELP_ID = 'bpmn/properties/timer_start_event_cycle';
const TIMER_START_EVENT_DATE_HELP_ID = 'bpmn/properties/timer_start_event_date';
const TIMER_START_EVENT_DURATION_HELP_ID = 'bpmn/properties/timer_start_event_duration';

function getPaneTitle(): string {
  return 'Timer Start Event';
}

function PaneFull(props: PaneComponentProps): React.JSX.Element {
  return (
    <Pane>
      <PaneHeader studio={props.studio} title={getPaneTitle()} paneId={props.paneId} collapsed={props.collapsed}>
        <PaneHeaderHelpIcon studio={props.studio} id={TIMER_START_EVENT_HELP_ID} />
      </PaneHeader>
      {props.collapsed !== true && <PaneContent {...props} />}
    </Pane>
  );
}

function shouldBeDisplayed(
  editorDocument: EditorDocument,
  editorDocumentModel: EditorDocumentModel,
  studio: Studio,
): boolean {
  return shouldBeDisplayedForBpmnElementOfType(editorDocument, editorDocumentModel, BpmnElementType.TimerStartEvent);
}

function PaneContent(props: PaneComponentProps): React.JSX.Element | null {
  const selection = getBpmnSelectionForPropertiesPane(props);

  if (selection == null) {
    return null;
  } else {
    return <PropertiesTimerStartEvent key={getKeyForPropertiesPane(selection)} {...props} />;
  }
}

const selectOptions: SelectOption[] = [
  { value: BpmnTimerType.Cycle, label: 'Cycle' },
  { value: BpmnTimerType.Date, label: 'Date' },
  { value: BpmnTimerType.Duration, label: 'Duration' },
];

function PropertiesTimerStartEvent(props: PaneComponentProps): React.JSX.Element {
  const cmd = props.studio.commands.getClickHandler();
  const bpmnDocumentModel: BpmnDocumentModel = props.editorDocumentModel;

  const element = bpmnDocumentModel.selection.getOnlyElementOrNull();
  assertBpmnElementIsTimerStartEvent(element);

  const initialValue = selectOptions.find((option) => option.value === element.timerType);

  const updateTimer = (newTimer: TimerToUpdate): void => {
    bpmnDocumentModel.elements.setElementProperty(element.id, 'timer', newTimer);
  };

  const changeDefinition = (newValue: string): void => {
    updateTimer({ timerDefinition: newValue });
  };

  const changeType = (newValue: string): void => {
    updateTimer({ timerType: newValue, timerDefinition: undefined });
  };

  const isCycleTimer = element.timerType === BpmnTimerType.Cycle;
  const enabled = element.enabled ?? false;

  const changeEnabled = (event: React.ChangeEvent<HTMLInputElement>): void => {
    bpmnDocumentModel.elements.setCustomProperty(element.id, 'enabled', event.target.checked ? 'true' : '');
  };

  return (
    <PaneBody key={`element_timer_type_${element.timerType}`}>
      <PaneProperty
        htmlId="timer-start-event-select"
        label="Type"
        type="select"
        value={initialValue}
        onChange={(newValue: any) => changeType(newValue.value)}
        options={selectOptions}
      />

      <TimerStartEventDefinition element={element} onChange={changeDefinition} cmd={cmd} studio={props.studio} />

      {isCycleTimer && (
        <div className="form-group">
          <Checkbox
            htmlId="timer-start-event-enabled-checkbox"
            key={enabled.toString()}
            checked={enabled}
            onChange={changeEnabled}
            label="Enabled"
          />
        </div>
      )}
    </PaneBody>
  );
}

function TimerStartEventDefinition(props: TimerStartEventDefinitionProps): React.JSX.Element | null {
  const timerType = props.element.timerType;

  switch (timerType) {
    case BpmnTimerType.Cycle:
      return <TimerStartEventCycleDefinition {...props} />;
    case BpmnTimerType.Date:
      return <TimerStartEventDateDefinition {...props} />;
    case BpmnTimerType.Duration:
      return <TimerStartEventDurationDefinition {...props} />;
    default:
      return null;
  }
}

function TimerStartEventCycleDefinition(props: TimerStartEventDefinitionProps): React.JSX.Element {
  return (
    <>
      <DefinitionProperty {...props} placeholder="e.g. 0 0 13 * * *" />
      <small>
        Use a crontab syntax to define intervals e.g. 0 0 13 * * * for &quot;everyday at 1pm&quot;.{' '}
        <a href="#" onClick={props.cmd('std.help.open', [TIMER_START_EVENT_CYCLE_HELP_ID])}>
          Learn more ...
        </a>
      </small>
    </>
  );
}

function TimerStartEventDateDefinition(props: TimerStartEventDefinitionProps): React.JSX.Element {
  return (
    <div className="form-group">
      <DefinitionProperty {...props} placeholder="YYYY-MM-DD HH:MM" />
      <small>
        Provide a date-time to define the execution time e.g. 2022-12-24, 12:12.
        <a href="#" onClick={props.cmd('std.help.open', [TIMER_START_EVENT_DATE_HELP_ID])}>
          Learn more ...
        </a>
      </small>
    </div>
  );
}

function TimerStartEventDurationDefinition(props: TimerStartEventDefinitionProps): React.JSX.Element {
  return (
    <>
      <DefinitionProperty {...props} placeholder="e.g. PT5S" />
      <small>
        Use the ISO 8601 duration standard to define durations, e.g. PT5S to wait 5 seconds.{' '}
        <a href="#" onClick={props.cmd('std.help.open', [TIMER_START_EVENT_DURATION_HELP_ID])}>
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
      htmlId="timer-start-event-definition-input"
      label={<LabelWithFeelExpressionHint studio={props.studio} label="Definition" />}
      type="text"
      value={props.element.timerDefinition}
      onCommit={(value: string) => props.onChange(value)}
      placeholder={props.placeholder}
    />
  );
}

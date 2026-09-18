import type { Bifrost } from '#bifrost/Bifrost';
import type { EditorDocument } from '#bifrost/contracts/EditorTypes';
import type { PaneComponentProps, PaneProvider } from '#bifrost/contracts/PaneTypes';
import { Pane } from '#components/panes/Pane';
import { PaneBody } from '#components/panes/PaneBody';
import { PaneHeader } from '#components/panes/PaneHeader';
import { PaneHeaderHelpIcon } from '#components/panes/PaneHeaderHelpIcon';
import type { ProjectProcess } from '#modules/bpmn-core/BpmnSpecificSolutionAndProjectTypes';
import { BpmnElementType } from '#modules/bpmn-editor/BpmnElementTypes';

import React from 'react';

import type { Suggestion } from '@evil/bifrost_fw_sdk';
import { PaneProperty } from '@evil/bifrost_fw_sdk';

import { assertBpmnElementIsCallActivity } from '../../BpmnElementTypeAssertionFunctions';
import {
  getBpmnSelectionForPropertiesPane,
  getKeyForPropertiesPane,
  shouldBeDisplayedForBpmnElementOfType,
} from '../../PropertiesPaneFunctions';
import { JumpToSymbolInSolutionLink } from '../../components/JumpToSymbolInSolutionLink';

type CallActivityToUpdate =
  CallActivityToUpdate_ProcessModelId | CallActivityToUpdate_StartEventId | CallActivityToUpdate_CalledProcessVersion;

type CallActivityToUpdate_ProcessModelId = {
  processModelId: string;
};

type CallActivityToUpdate_StartEventId = {
  startEventId: string;
};

type CallActivityToUpdate_CalledProcessVersion = {
  calledProcessVersion: string;
};

type TargetProcessLinkWithLabelProps = {
  processModelId: string;
  studio: Bifrost;
};

export const paneProvider: PaneProvider = {
  getPaneTitle: getPaneTitle,
  shouldBeDisplayed: shouldBeDisplayed,
  Pane: PaneFull,
  PaneContent: PaneContent,
};

function getPaneTitle(): string {
  return 'Call Activity';
}

function PaneFull(props: PaneComponentProps): React.JSX.Element {
  const { studio } = props;

  return (
    <Pane>
      <PaneHeader studio={studio} title={getPaneTitle()} paneId={props.paneId} collapsed={props.collapsed}>
        <PaneHeaderHelpIcon studio={studio} id="bpmn/properties/call_activity" />
      </PaneHeader>
      {props.collapsed !== true && <PaneContent {...props} />}
    </Pane>
  );
}

function shouldBeDisplayed(editorDocument: EditorDocument, editorDocumentModel: any): boolean {
  return shouldBeDisplayedForBpmnElementOfType(editorDocument, editorDocumentModel, BpmnElementType.CallActivity);
}

function PaneContent(props: PaneComponentProps): React.JSX.Element | null {
  const selection = getBpmnSelectionForPropertiesPane(props);
  if (selection == null) {
    return null;
  }
  return <PropertiesCallActivity key={getKeyForPropertiesPane(selection)} {...props} />;
}

export function PropertiesCallActivity(props: PaneComponentProps): React.JSX.Element {
  const element = props.editorDocumentModel.selection.getOnlyElementOrNull();
  assertBpmnElementIsCallActivity(element);

  const processModelId = element.processModelId;
  const startEventId = element.startEventId;
  const calledProcessVersion = element.calledProcessVersion ?? '';

  const onCalledProcessChange = (newValue: any): void => {
    updateCallActivityProcess({ processModelId: newValue?.value ?? '' });
  };

  const onStartEventChange = (newValue: any): void => {
    updateCallActivity({ startEventId: newValue?.value ?? '' });
  };

  const onCalledProcessVersionChange = (value: string): void => {
    updateCallActivity({ calledProcessVersion: value });
  };

  const updateCallActivity = (newCallActivity: CallActivityToUpdate): void => {
    props.editorDocumentModel.elements.setElementProperty(element.id, 'callActivity', newCallActivity);
  };

  const updateCallActivityProcess = async (newCallActivity: CallActivityToUpdate_ProcessModelId): Promise<void> => {
    const startEventsFromNewProcessModelId = await props.studio.commands.executeCommand<Promise<string[]>>(
      'bpmn.project.getAllStartEventsForProcessId',
      [newCallActivity.processModelId],
    );

    if (!startEventId || !startEventsFromNewProcessModelId.includes(startEventId)) {
      updateCallActivity({ startEventId: '' });
    }

    props.editorDocumentModel.elements.setElementProperty(element.id, 'callActivity', newCallActivity);
  };

  const getProcessSuggestions = async (): Promise<Suggestion[]> => {
    const allUniqueProcessIdsInProject = await props.studio.commands.executeCommand<ProjectProcess[]>(
      'bpmn.project.getAllReachableProcesses',
      [props.editorDocument.uri],
    );

    return allUniqueProcessIdsInProject.map((process) => {
      return {
        label: process.processId,
        sublabel: process.filename,
        value: process.processId,
      };
    });
  };

  const allStartEventsForProcessIdPromise = props.studio.commands.executeCommand<Promise<string[]>>(
    'bpmn.project.getAllStartEventsForProcessId',
    [processModelId],
  );

  return (
    <PaneBody key={`element_process_id_${processModelId}`}>
      <PaneProperty
        label={<TargetProcessLinkWithLabel processModelId={processModelId} studio={props.studio} />}
        type="text-with-suggestions"
        htmlId="call-activity-process-id-property"
        placeholder="Type process ID..."
        value={processModelId}
        onCommit={onCalledProcessChange}
        suggestions={getProcessSuggestions()}
        isClearable={true}
      />
      <PaneProperty
        label="Start Event"
        key={`element_start_event_id_${startEventId}`}
        type="text-with-suggestions"
        htmlId="call-activity-start-event-id-property"
        placeholder="Type a start event ID..."
        value={startEventId ?? ''}
        onCommit={onStartEventChange}
        suggestions={allStartEventsForProcessIdPromise}
        isClearable={true}
      />
      <PaneProperty
        key={`element_called_process_version_${calledProcessVersion}`}
        label="Called process version"
        type="text"
        htmlId="call-activity-called-process-version-property"
        placeholder="Leave empty for newest deployed version"
        value={calledProcessVersion}
        onCommit={onCalledProcessVersionChange}
      />
    </PaneBody>
  );
}

function TargetProcessLinkWithLabel(props: TargetProcessLinkWithLabelProps): React.JSX.Element {
  if (props.processModelId == null || props.processModelId.trim().length === 0) {
    return <>Process</>;
  }

  const getSymbolFromIndexPromise = props.studio.symbolIndex.getAll({}).then((allSymbols) => {
    return allSymbols.find((symbol) => symbol.id === props.processModelId);
  });

  return (
    <>
      Process <JumpToSymbolInSolutionLink studio={props.studio} promise={getSymbolFromIndexPromise} />
    </>
  );
}

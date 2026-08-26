import type { Bifrost } from '#bifrost/Bifrost';
import type { EditorDocument } from '#bifrost/contracts/EditorTypes';
import type { PaneComponentProps, PaneProvider } from '#bifrost/contracts/PaneTypes';
import { Pane } from '#components/panes/Pane';
import { PaneBody } from '#components/panes/PaneBody';
import { PaneHeader } from '#components/panes/PaneHeader';
import type { FlowNodeInstance } from '@elraptorus/daemonengine_sdk';
import type { TimerEventDefinition } from '@elraptorus/daemonengine_sdk';
import dayjs from 'dayjs';
import duration from 'dayjs/plugin/duration';

import React from 'react';

import { PaneProperty } from '@evil/bifrost_fw_sdk';

import type EngineBpmnDebuggerEditorDocumentModel from '../../EngineBpmnDebuggerEditorDocumentModel';
import { getTypePropertyString } from '../../libs/BpmnFlowNodeAccessors';
import { getEventDefinition } from '../../libs/BpmnProcessHelpers';
import type { FlowNode } from '../../libs/index';
import { shouldDisplayTimerEventPane } from '../ShouldBeDisplayedConditions';

dayjs.extend(duration);

type TimerEventDefinitionPaneProps = {
  editorDocument: EditorDocument;
  model: EngineBpmnDebuggerEditorDocumentModel;
  studio: Bifrost;
  flowNode: FlowNode;
};

export const paneProvider: PaneProvider = {
  getPaneTitle: getPaneTitle,
  shouldBeDisplayed: shouldDisplayTimerEventPane,
  Pane: PaneFull,
  PaneContent: TimerEventDefinitionPane,
};

function getPaneTitle(): string {
  return 'Timer Event';
}

function PaneFull(props: PaneComponentProps): React.JSX.Element {
  const studio = props.studio;
  const model = props.editorDocumentModel as EngineBpmnDebuggerEditorDocumentModel;
  const flowNode = model.selectedElements[0] as FlowNode;

  return (
    <Pane>
      <PaneHeader studio={props.studio} title={getPaneTitle()} paneId={props.paneId} collapsed={props.collapsed} />
      {props.collapsed !== true && (
        <TimerEventDefinitionPane
          editorDocument={props.editorDocument}
          flowNode={flowNode}
          model={props.editorDocumentModel}
          studio={studio}
        />
      )}
    </Pane>
  );
}

function TimerEventDefinitionPane(props: TimerEventDefinitionPaneProps): React.JSX.Element {
  const flowNodeModel = props.flowNode.flowNodeModel;
  const timerDefinition = flowNodeModel ? (getEventDefinition(flowNodeModel) as TimerEventDefinition | null) : null;

  const selectedFlowNodeInstance = props.model.getSelectedFlowNodeInstanceByFlowNode(
    props.flowNode,
  ) as FlowNodeInstance;

  const cmd = props.studio.commands.getClickHandler();

  const timerKind = resolveTimerKind(timerDefinition);
  const isCronjob = timerKind === 'timeCycle';

  const timerTypeLabel =
    isCronjob && props.model.processModel?.id ? (
      <>
        Timer Type{' '}
        <small>
          <a
            href="#"
            onClick={cmd('engine.browser.showCronjobsForStartEvent', [
              props.model.engineUrl,
              props.model.processModel.id,
              flowNodeModel?.id ?? '',
            ])}
          >
            Show in Cyclic Timers
          </a>
        </small>
      </>
    ) : (
      'Timer Type'
    );

  const evaluatedFireAt = getTypePropertyString(selectedFlowNodeInstance.typeProperties, 'fire_at');
  const definitionValue =
    timerDefinition?.timeCycle ?? timerDefinition?.timeDate ?? timerDefinition?.timeDuration ?? '';

  return (
    <PaneBody>
      <PaneProperty
        type="text"
        label={timerTypeLabel}
        disabled={true}
        value={getTimerTypeHumanReadableText(timerKind)}
      />
      <PaneProperty type="text" label="Timer Value (Evaluated)" disabled={true} value={evaluatedFireAt} />
      <PaneProperty type="text" label="Timer Value (Definition)" disabled={true} value={definitionValue} />
      <PaneProperty
        type="text"
        label="Calculated Execution Time"
        disabled={true}
        value={getPlannedExecutionTime(timerKind, selectedFlowNodeInstance, evaluatedFireAt)}
      />
    </PaneBody>
  );
}

type TimerKind = 'timeCycle' | 'timeDate' | 'timeDuration' | 'unknown';

function resolveTimerKind(timerDefinition: TimerEventDefinition | null): TimerKind {
  if (!timerDefinition || timerDefinition.type !== 'timer') {
    return 'unknown';
  }
  if (timerDefinition.timeCycle) {
    return 'timeCycle';
  }
  if (timerDefinition.timeDate) {
    return 'timeDate';
  }
  if (timerDefinition.timeDuration) {
    return 'timeDuration';
  }
  return 'unknown';
}

function getPlannedExecutionTime(
  timerKind: TimerKind,
  flowNodeInstance: FlowNodeInstance,
  evaluatedFireAt: string,
): string {
  if (!evaluatedFireAt) {
    return '';
  }

  if (timerKind === 'timeDate' || timerKind === 'timeCycle') {
    return dayjs(evaluatedFireAt).format('YYYY-MM-DD HH:mm:ss');
  }

  if (timerKind === 'timeDuration') {
    const parsedDuration = dayjs.duration(evaluatedFireAt);
    const expirationDate = dayjs(flowNodeInstance.startedAt).add(parsedDuration);
    return expirationDate.format('YYYY-MM-DD HH:mm:ss');
  }

  return evaluatedFireAt;
}

function getTimerTypeHumanReadableText(timerKind: TimerKind): string {
  if (timerKind === 'timeCycle') {
    return 'Cronjob';
  }
  if (timerKind === 'timeDate') {
    return 'Date';
  }
  if (timerKind === 'timeDuration') {
    return 'Duration';
  }
  return 'unknown';
}

import {
  createCallActivityTargetLink,
  createDocumentationBadge,
  createProcessNotExecutableOverlay,
} from '#modules/bpmn-core/overlays';
import type { Overlay } from '#modules/bpmn-core/overlays/BpmnElementOverlayManager';
import type { BpmnProcess } from '@elraptorus/daemonengine_sdk';

import type { Studio } from '@evil/bifrost_fw_sdk';

import { MODEL_VIEWER_COMMANDS } from '../commands/ModelViewerCommands';
import { findFlowNodeById } from '../panes/paneHelpers';
import { createStartProcessOverlay } from './StartProcessOverlay';

export function createModelViewerFlowNodeOverlays(
  flowNode: any,
  studio: Studio,
  engineId: string,
  processModelId: string,
  bpmnProcess: BpmnProcess | null = null,
): Overlay[] {
  const overlays: Overlay[] = [];

  if (flowNode.type === 'bpmn:StartEvent') {
    const businessObject = flowNode.businessObject;
    const isTopLevel = !businessObject?.$parent?.triggeredByEvent;
    if (isTopLevel) {
      overlays.push(createStartProcessOverlay(studio, flowNode.id, engineId, processModelId));
    }
  }

  if (flowNode.type === 'bpmn:CallActivity') {
    const modeled = bpmnProcess ? findFlowNodeById(bpmnProcess, flowNode.id) : undefined;
    const calledElement = modeled?.typeData.type === 'call_activity' ? modeled.typeData.calledElement : undefined;
    if (calledElement) {
      overlays.push(
        createCallActivityTargetLink(
          studio,
          flowNode.id,
          MODEL_VIEWER_COMMANDS.openCallActivityTarget,
          [engineId, calledElement],
          `Open "${calledElement}" in a new tab`,
        ),
      );
    }
  }

  if (flowNode.type === 'bpmn:BusinessRuleTask') {
    const modeled = bpmnProcess ? findFlowNodeById(bpmnProcess, flowNode.id) : undefined;
    if (modeled?.typeData.type === 'business_rule_task' && modeled.typeData.implementation === 'dmn') {
      const decisionRef = modeled.typeData.decisionRef;
      if (typeof decisionRef === 'string' && decisionRef.length > 0) {
        overlays.push(
          createCallActivityTargetLink(
            studio,
            flowNode.id,
            'engine.workspace.openDecisionViewer',
            [engineId, decisionRef],
            `Open DMN "${decisionRef}" in a new tab`,
          ),
        );
      }
    }
  }

  const documentation = flowNode.businessObject?.documentation?.[0]?.text;
  if (documentation && studio.settings.get('bpmn.editor.showDocumentationMarker')) {
    overlays.push(createDocumentationBadge(flowNode.id, studio, () => openDocumentationPane(studio)));
  }

  return overlays;
}

function openDocumentationPane(studio: Studio): void {
  studio.panes.setActiveGroupInArea('right', 'documentation');
  studio.panes.showPaneArea('right');
}

export function createModelViewerProcessOverlays(
  participantId: string,
  isExecutable: boolean,
  studio: Studio,
): Overlay[] {
  const overlays: Overlay[] = [];

  if (!isExecutable) {
    overlays.push(createProcessNotExecutableOverlay(participantId, studio));
  }

  return overlays;
}

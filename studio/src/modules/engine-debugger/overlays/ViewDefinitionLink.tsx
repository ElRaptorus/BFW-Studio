import type { Overlay } from '#modules/bpmn-core/overlays/BpmnElementOverlayManager';
import { OverlayPosition } from '#modules/bpmn-core/overlays/BpmnElementOverlayManager';

import React from 'react';

import type { Studio } from '@evil/bifrost_fw_sdk';
import { Icon } from '@evil/bifrost_fw_sdk';

import type EngineBpmnDebuggerEditorDocumentModel from '../EngineBpmnDebuggerEditorDocumentModel';

export type ViewDefinitionLinkProps = {
  model: EngineBpmnDebuggerEditorDocumentModel;
  studio: Studio;
};

export function createViewDefinitionLink(
  elementId: string,
  model: EngineBpmnDebuggerEditorDocumentModel,
  studio: Studio,
): Overlay {
  return {
    type: 'positioned',
    elementId: elementId,
    position: OverlayPosition.below,
    overlayElement: ViewDefinitionLink,
    overlayProps: { model: model, studio: studio },
  };
}

export function ViewDefinitionLink(props: ViewDefinitionLinkProps): React.JSX.Element {
  const isEnabled = props.studio.commands.isCommandEnabled('engine.workspace.openModelViewer', [
    props.model.engineId,
    props.model.processInstance?.processModelId ?? '',
  ]);

  return (
    <div
      className={`bpmn-element-overlay__below-item bpmn-element-overlay__below-item--action${isEnabled ? '' : ' bpmn-element-overlay__below-item--disabled'}`}
      onClick={() => {
        if (!isEnabled) {
          return;
        }
        props.studio.commands.executeCommand('engine.workspace.openModelViewer', [
          props.model.engineId,
          props.model.processInstance?.processModelId ?? '',
        ]);
      }}
      data-bs-title="View deployed process model"
      data-bs-toggle="tooltip"
    >
      <div className="action-icon">
        <Icon id="ph ph-file-magnifying-glass" />
      </div>
      <div className="action-icon-hovered">
        <Icon id="ph-fill ph-file-magnifying-glass" />
      </div>
    </div>
  );
}

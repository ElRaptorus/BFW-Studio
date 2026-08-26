import type { Bifrost } from '#bifrost/Bifrost';
import { Icon } from '#components/Icon';
import type { Overlay } from '#modules/bpmn-core/overlays/BpmnElementOverlayManager';
import { OverlayPosition } from '#modules/bpmn-core/overlays/BpmnElementOverlayManager';

import React from 'react';

import type EngineBpmnDebuggerEditorDocumentModel from '../EngineBpmnDebuggerEditorDocumentModel';

export type ParentProcessInstanceLinkProps = {
  model: EngineBpmnDebuggerEditorDocumentModel;
  parentProcessInstanceId: string;
  studio: Bifrost;
};

export function createParentProcessInstanceLink(
  elementId: string,
  model: EngineBpmnDebuggerEditorDocumentModel,
  parentProcessInstanceId: string,
  studio: Bifrost,
): Overlay {
  return {
    type: 'positioned',
    elementId: elementId,
    position: OverlayPosition.below,
    overlayElement: ParentProcessInstanceLink,
    overlayProps: { model: model, parentProcessInstanceId: parentProcessInstanceId, studio: studio },
  };
}

export function ParentProcessInstanceLink(props: ParentProcessInstanceLinkProps): React.JSX.Element {
  return (
    <div
      className="bpmn-element-overlay__below-item bpmn-element-overlay__below-item--action"
      onClick={() =>
        props.studio.commands.executeCommand('engine.debugger.goToParentProcessInstance', [
          props.model.engineUrl,
          props.parentProcessInstanceId,
        ])
      }
      data-bs-title="Go to Parent Process Instance"
      data-bs-toggle="tooltip"
    >
      <div className="action-icon">
        <Icon id="ph ph-arrow-square-out" />
      </div>
      <div className="action-icon-hovered">
        <Icon id="ph-fill ph-arrow-square-out" />
      </div>
    </div>
  );
}

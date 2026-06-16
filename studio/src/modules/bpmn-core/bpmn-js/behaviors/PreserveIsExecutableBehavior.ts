import type Canvas from 'diagram-js/lib/core/Canvas';
import type EventBus from 'diagram-js/lib/core/EventBus';

const PARTICIPANT_TYPE = 'bpmn:Participant';
const PROCESS_TYPE = 'bpmn:Process';
const LOW_PRIORITY = 250;

/**
 * Preserves the `isExecutable` flag when the last Participant is deleted and
 * the diagram reverts from a Collaboration to a plain Process.
 *
 * Without this, bpmn-js resets the process to `isExecutable=false` by default,
 * which the engine requires to be `true` (validator rule D20 / D21).
 */
interface BpmnModeling {
  updateProperties(element: any, properties: Record<string, any>): void;
}

function PreserveIsExecutableBehavior(this: any, eventBus: EventBus, canvas: Canvas, modeling: BpmnModeling) {
  eventBus.on('commandStack.shape.delete.postExecuted', LOW_PRIORITY, (event: any) => {
    const context = event.context;
    const shape = context?.shape;

    if (shape?.type !== PARTICIPANT_TYPE) {
      return;
    }

    const collaborationRoot = context.collaborationRoot;
    if (collaborationRoot == null) {
      return;
    }

    const remainingParticipants = collaborationRoot.businessObject?.get('participants');
    if (remainingParticipants != null && remainingParticipants.length > 0) {
      return;
    }

    const newRoot = canvas.getRootElement();
    if (newRoot?.type !== PROCESS_TYPE) {
      return;
    }

    const oldProcessBusinessObject = shape.businessObject?.get('processRef');
    if (oldProcessBusinessObject == null) {
      return;
    }

    const wasExecutable = oldProcessBusinessObject.get('isExecutable');
    if (wasExecutable != null) {
      modeling.updateProperties(newRoot, { isExecutable: wasExecutable });
    }
  });
}

(PreserveIsExecutableBehavior as any).$inject = ['eventBus', 'canvas', 'modeling'];

export default PreserveIsExecutableBehavior;

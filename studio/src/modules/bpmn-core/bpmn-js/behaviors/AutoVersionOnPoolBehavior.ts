import type EventBus from 'diagram-js/lib/core/EventBus';

import { CmdHelper } from '../CommandHandler/Helper/CommmandHelper';
import { findBfwExtension, setBfwBodyExtension } from '../CommandHandler/Utils/BfwExtensionHelper';

const LOW_PRIORITY = 250;
const BFW_VERSION_TYPE = 'bfw:Version';
const DEFAULT_VERSION = '1.0.0';

/**
 * Automatically assigns `bfw:Version` "1.0.0" to the process referenced by a
 * newly created Participant (pool), if the process does not already have one.
 *
 * Only fires for `shape.create` — existing diagrams and undo/redo are unaffected.
 */
function AutoVersionOnPoolBehavior(this: any, eventBus: EventBus, bpmnFactory: any, commandStack: any) {
  eventBus.on('commandStack.shape.create.postExecuted', LOW_PRIORITY, (event: any) => {
    const shape = event.context?.shape;
    if (shape?.type !== 'bpmn:Participant') {
      return;
    }

    const processRef = shape.businessObject?.processRef;
    if (!processRef) {
      return;
    }

    if (findBfwExtension(processRef, BFW_VERSION_TYPE) != null) {
      return;
    }

    const processElement = { businessObject: processRef };
    const commands = setBfwBodyExtension(processElement, bpmnFactory, BFW_VERSION_TYPE, DEFAULT_VERSION);
    if (commands.length === 0) {
      return;
    }

    const batch = CmdHelper.executeMultipleCommands(commands);
    commandStack.execute(batch.cmd, batch.context);
  });
}

(AutoVersionOnPoolBehavior as any).$inject = ['eventBus', 'bpmnFactory', 'commandStack'];

export default AutoVersionOnPoolBehavior;

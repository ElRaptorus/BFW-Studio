import { getBusinessObject } from 'bpmn-js/lib/util/ModelUtil';
import type CommandStack from 'diagram-js/lib/command/CommandStack';

import { CmdHelper } from './Helper/CommmandHelper';

const MODDLE_BPMN_LINK_EVENT_DEFINITION_TYPE = 'bpmn:LinkEventDefinition';

export function UpdateLinkHandler(this: any, commandStack: CommandStack): void {
  this.commandStack = commandStack;
}

UpdateLinkHandler.$inject = ['commandStack'];

UpdateLinkHandler.prototype.preExecute = function (context: any) {
  const { element, newLinkName } = context;

  const businessObject = getBusinessObject(element);

  const elementIsLinkEventDefinition =
    businessObject.eventDefinitions != null &&
    businessObject.eventDefinitions.length !== 0 &&
    businessObject.eventDefinitions.some((definition) => definition.$type === MODDLE_BPMN_LINK_EVENT_DEFINITION_TYPE);

  let selectedLink;

  if (elementIsLinkEventDefinition) {
    selectedLink = businessObject.eventDefinitions.find(
      (definition) => definition.$type === MODDLE_BPMN_LINK_EVENT_DEFINITION_TYPE,
    );
  }

  if (selectedLink != null) {
    if (selectedLink.name === newLinkName) {
      return;
    }

    const props = {
      name: newLinkName,
    };

    const commandToExecute = CmdHelper.updateBusinessObject(element, selectedLink, props);
    this.commandStack.execute(commandToExecute.cmd, commandToExecute.context);
  }
};

export default UpdateLinkHandler;

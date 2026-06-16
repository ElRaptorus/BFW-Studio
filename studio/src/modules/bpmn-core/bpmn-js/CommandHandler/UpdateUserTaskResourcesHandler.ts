import { getBusinessObject } from 'bpmn-js/lib/util/ModelUtil';
import type CommandStack from 'diagram-js/lib/command/CommandStack';

import { CmdHelper } from './Helper/CommmandHelper';

const MODDLE_BPMN_HUMAN_PERFORMER = 'bpmn:HumanPerformer';
const MODDLE_BPMN_POTENTIAL_OWNER = 'bpmn:PotentialOwner';
const MODDLE_BPMN_RESOURCE_ASSIGNMENT_EXPRESSION = 'bpmn:ResourceAssignmentExpression';
const MODDLE_BPMN_FORMAL_EXPRESSION = 'bpmn:FormalExpression';

export function UpdateUserTaskResourcesHandler(this: any, commandStack: CommandStack, bpmnFactory: any): void {
  this.commandStack = commandStack;
  this.bpmnFactory = bpmnFactory;
}

UpdateUserTaskResourcesHandler.$inject = ['commandStack', 'bpmnFactory'];

UpdateUserTaskResourcesHandler.prototype.preExecute = function (context: any) {
  const { element, assignee, candidateUsers } = context;
  const businessObject = getBusinessObject(element);

  const resources: any[] = businessObject.resources ?? [];
  const commands: any[] = [];

  const updateOrCreateResourceRole = (resourceType: string, newValue: string | undefined): void => {
    if (newValue === undefined) {
      return;
    }

    const existing = resources.find((res: any) => res.$type === resourceType);

    if (existing != null) {
      if (newValue === '') {
        commands.push(CmdHelper.removeElementsFromList(element, businessObject, 'resources', undefined, [existing]));
      } else {
        const expression = existing.resourceAssignmentExpression?.expression;
        if (expression != null) {
          if (expression.body !== newValue) {
            commands.push(CmdHelper.updateBusinessObject(element, expression, { body: newValue }));
          }
        } else {
          const formalExpression = this.bpmnFactory.create(MODDLE_BPMN_FORMAL_EXPRESSION, {
            body: newValue,
          });
          const assignmentExpression = this.bpmnFactory.create(MODDLE_BPMN_RESOURCE_ASSIGNMENT_EXPRESSION, {
            expression: formalExpression,
          });
          formalExpression.$parent = assignmentExpression;
          assignmentExpression.$parent = existing;
          commands.push(
            CmdHelper.updateBusinessObject(element, existing, {
              resourceAssignmentExpression: assignmentExpression,
            }),
          );
        }
      }
    } else if (newValue) {
      const formalExpression = this.bpmnFactory.create(MODDLE_BPMN_FORMAL_EXPRESSION, {
        body: newValue,
      });
      const assignmentExpression = this.bpmnFactory.create(MODDLE_BPMN_RESOURCE_ASSIGNMENT_EXPRESSION, {
        expression: formalExpression,
      });
      const resourceRole = this.bpmnFactory.create(resourceType, {
        resourceAssignmentExpression: assignmentExpression,
      });
      formalExpression.$parent = assignmentExpression;
      assignmentExpression.$parent = resourceRole;
      resourceRole.$parent = businessObject;

      commands.push(CmdHelper.addElementsTolist(element, businessObject, 'resources', [resourceRole]));
    }
  };

  updateOrCreateResourceRole(MODDLE_BPMN_HUMAN_PERFORMER, assignee);
  updateOrCreateResourceRole(MODDLE_BPMN_POTENTIAL_OWNER, candidateUsers);

  if (commands.length > 0) {
    const commandToExecute = CmdHelper.executeMultipleCommands(commands);
    this.commandStack.execute(commandToExecute.cmd, commandToExecute.context);
  }
};

export default UpdateUserTaskResourcesHandler;

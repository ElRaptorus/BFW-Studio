import { getBusinessObject } from 'bpmn-js/lib/util/ModelUtil';
import type CommandStack from 'diagram-js/lib/command/CommandStack';

import { CmdHelper } from './Helper/CommmandHelper';
import { setBfwBodyExtension } from './Utils/BfwExtensionHelper';

const MODDLE_BPMN_FORMAL_EXPRESSION_TYPE = 'bpmn:FormalExpression';

export function UpdateLoopCharacteristicsHandler(this: any, commandStack: CommandStack, bpmnFactory: any): void {
  this.commandStack = commandStack;
  this.bpmnFactory = bpmnFactory;
}

UpdateLoopCharacteristicsHandler.$inject = ['commandStack', 'bpmnFactory'];

UpdateLoopCharacteristicsHandler.prototype.preExecute = function (context: any) {
  const { command, ...restArgs } = context;

  const updateStandardLoop = (args: any): void => {
    const { element, loopCondition, loopMaximum, testBefore, loopInterval } = args;
    const businessObject = getBusinessObject(element);
    const loopCharacteristics = businessObject.loopCharacteristics;

    if (!loopCharacteristics || loopCharacteristics.$type !== 'bpmn:StandardLoopCharacteristics') {
      return;
    }

    const commands: any[] = [];

    if (loopCondition !== undefined) {
      const existingExpression = loopCharacteristics.loopCondition;

      if (existingExpression != null) {
        if (existingExpression.body !== loopCondition) {
          commands.push(CmdHelper.updateBusinessObject(element, existingExpression, { body: loopCondition }));
        }
      } else if (loopCondition) {
        const formalExpression = this.bpmnFactory.create(MODDLE_BPMN_FORMAL_EXPRESSION_TYPE, {
          body: loopCondition,
        });
        formalExpression.$parent = loopCharacteristics;
        commands.push(
          CmdHelper.updateBusinessObject(element, loopCharacteristics, { loopCondition: formalExpression }),
        );
      }
    }

    if (loopMaximum !== undefined) {
      const parsedMax = loopMaximum === '' || loopMaximum == null ? undefined : loopMaximum;
      if (loopCharacteristics.loopMaximum !== parsedMax) {
        commands.push(CmdHelper.updateBusinessObject(element, loopCharacteristics, { loopMaximum: parsedMax }));
      }
    }

    if (testBefore !== undefined) {
      const boolValue = testBefore === true || testBefore === 'true';
      if (loopCharacteristics.testBefore !== boolValue) {
        commands.push(CmdHelper.updateBusinessObject(element, loopCharacteristics, { testBefore: boolValue }));
      }
    }

    const loopCharsElement = { businessObject: loopCharacteristics };
    if (loopInterval !== undefined) {
      commands.push(...setBfwBodyExtension(loopCharsElement, this.bpmnFactory, 'bfw:LoopInterval', loopInterval));
    }

    if (commands.length > 0) {
      const commandToExecute = CmdHelper.executeMultipleCommands(commands);
      this.commandStack.execute(commandToExecute.cmd, commandToExecute.context);
    }
  };

  const updateMultiInstance = (args: any): void => {
    const {
      element,
      completionCondition,
      inputDataItem,
      outputDataItem,
      elementVariable,
      outputElementVariable,
      inputCollection,
      outputCollection,
      loopBreakCondition,
      loopInterval,
      maxIterations,
    } = args;
    const businessObject = getBusinessObject(element);
    const loopCharacteristics = businessObject.loopCharacteristics;

    if (!loopCharacteristics || loopCharacteristics.$type !== 'bpmn:MultiInstanceLoopCharacteristics') {
      return;
    }

    const commands: any[] = [];

    const updateOrCreateFormalExpression = (propertyName: string, newValue: string | undefined): void => {
      if (newValue === undefined) {
        return;
      }

      const existing = loopCharacteristics[propertyName];
      if (existing != null) {
        if (existing.body !== newValue) {
          commands.push(CmdHelper.updateBusinessObject(element, existing, { body: newValue }));
        }
      } else if (newValue) {
        const formalExpression = this.bpmnFactory.create(MODDLE_BPMN_FORMAL_EXPRESSION_TYPE, {
          body: newValue,
        });
        formalExpression.$parent = loopCharacteristics;
        commands.push(
          CmdHelper.updateBusinessObject(element, loopCharacteristics, { [propertyName]: formalExpression }),
        );
      }
    };

    updateOrCreateFormalExpression('completionCondition', completionCondition);

    if (inputDataItem !== undefined) {
      const existing = loopCharacteristics.inputDataItem;
      if (existing != null) {
        if (existing.name !== inputDataItem) {
          commands.push(CmdHelper.updateBusinessObject(element, existing, { name: inputDataItem }));
        }
      } else if (inputDataItem) {
        const dataInput = this.bpmnFactory.create('bpmn:DataInput', { name: inputDataItem });
        dataInput.$parent = loopCharacteristics;
        commands.push(CmdHelper.updateBusinessObject(element, loopCharacteristics, { inputDataItem: dataInput }));
      }
    }

    if (outputDataItem !== undefined) {
      const existing = loopCharacteristics.outputDataItem;
      if (existing != null) {
        if (existing.name !== outputDataItem) {
          commands.push(CmdHelper.updateBusinessObject(element, existing, { name: outputDataItem }));
        }
      } else if (outputDataItem) {
        const dataOutput = this.bpmnFactory.create('bpmn:DataOutput', { name: outputDataItem });
        dataOutput.$parent = loopCharacteristics;
        commands.push(CmdHelper.updateBusinessObject(element, loopCharacteristics, { outputDataItem: dataOutput }));
      }
    }

    const loopCharsElement = { businessObject: loopCharacteristics };
    if (inputCollection !== undefined) {
      commands.push(...setBfwBodyExtension(loopCharsElement, this.bpmnFactory, 'bfw:InputCollection', inputCollection));
    }
    if (outputCollection !== undefined) {
      commands.push(
        ...setBfwBodyExtension(loopCharsElement, this.bpmnFactory, 'bfw:OutputCollection', outputCollection),
      );
    }
    if (elementVariable !== undefined) {
      commands.push(...setBfwBodyExtension(loopCharsElement, this.bpmnFactory, 'bfw:ElementVariable', elementVariable));
    }
    if (outputElementVariable !== undefined) {
      commands.push(
        ...setBfwBodyExtension(loopCharsElement, this.bpmnFactory, 'bfw:OutputElementVariable', outputElementVariable),
      );
    }
    if (loopBreakCondition !== undefined) {
      commands.push(
        ...setBfwBodyExtension(loopCharsElement, this.bpmnFactory, 'bfw:LoopBreakCondition', loopBreakCondition),
      );
    }
    if (loopInterval !== undefined) {
      commands.push(...setBfwBodyExtension(loopCharsElement, this.bpmnFactory, 'bfw:LoopInterval', loopInterval));
    }
    if (maxIterations !== undefined) {
      const stringValue = maxIterations != null && maxIterations !== '' ? String(maxIterations) : null;
      commands.push(...setBfwBodyExtension(loopCharsElement, this.bpmnFactory, 'bfw:MaxIterations', stringValue));
    }

    if (commands.length > 0) {
      const commandToExecute = CmdHelper.executeMultipleCommands(commands);
      this.commandStack.execute(commandToExecute.cmd, commandToExecute.context);
    }
  };

  const commandHandler = {
    updateStandardLoop,
    updateMultiInstance,
  };

  commandHandler[command](restArgs);
};

export default UpdateLoopCharacteristicsHandler;

import { getBusinessObject } from 'bpmn-js/lib/util/ModelUtil';
import type CommandStack from 'diagram-js/lib/command/CommandStack';

import { CmdHelper } from './Helper/CommmandHelper';
import { removeBfwExtension, setBfwBodyExtension } from './Utils/BfwExtensionHelper';

const BFW_HTTP_URL = 'bfw:HttpUrl';
const BFW_HTTP_METHOD = 'bfw:HttpMethod';
const BFW_HTTP_BODY = 'bfw:HttpBody';
const BFW_HTTP_AUTH_HEADER = 'bfw:HttpAuthHeader';
const BFW_HTTP_RESPONSE_HEADERS = 'bfw:HttpResponseHeaders';

const HTTP_BFW_TYPES = [BFW_HTTP_URL, BFW_HTTP_METHOD, BFW_HTTP_BODY, BFW_HTTP_AUTH_HEADER, BFW_HTTP_RESPONSE_HEADERS];

export function UpdateServiceTaskHandler(this: any, commandStack: CommandStack, bpmnFactory: any): void {
  this.commandStack = commandStack;
  this.bpmnFactory = bpmnFactory;
}

UpdateServiceTaskHandler.$inject = ['commandStack', 'bpmnFactory'];

UpdateServiceTaskHandler.prototype.preExecute = function (context: any) {
  const { command, ...restArgs } = context;

  const updateType = (args: any): void => {
    const { element, newImplementation } = args;
    const businessObject = getBusinessObject(element);
    const commands: any[] = [];

    commands.push(
      CmdHelper.updateBusinessObject(element, businessObject, {
        implementation: newImplementation || undefined,
      }),
    );

    if (newImplementation !== 'http') {
      for (const extensionType of HTTP_BFW_TYPES) {
        commands.push(...removeBfwExtension(element, extensionType));
      }
    }

    const commandToExecute = CmdHelper.executeMultipleCommands(commands);
    this.commandStack.execute(commandToExecute.cmd, commandToExecute.context);
  };

  const updateHttpTask = (args: any): void => {
    const { element, newMethod, newUrl, newBody, newAuthHeader, newResponseHeaders } = args;
    const commands: any[] = [];

    commands.push(...setBfwBodyExtension(element, this.bpmnFactory, BFW_HTTP_URL, newUrl));
    commands.push(...setBfwBodyExtension(element, this.bpmnFactory, BFW_HTTP_METHOD, newMethod));
    commands.push(...setBfwBodyExtension(element, this.bpmnFactory, BFW_HTTP_BODY, newBody));
    commands.push(...setBfwBodyExtension(element, this.bpmnFactory, BFW_HTTP_AUTH_HEADER, newAuthHeader));
    commands.push(...setBfwBodyExtension(element, this.bpmnFactory, BFW_HTTP_RESPONSE_HEADERS, newResponseHeaders));

    if (commands.length > 0) {
      const commandToExecute = CmdHelper.executeMultipleCommands(commands);
      this.commandStack.execute(commandToExecute.cmd, commandToExecute.context);
    }
  };

  const commandHandler = {
    updateType,
    updateHttpTask,
  };

  commandHandler[command](restArgs);
};

export default UpdateServiceTaskHandler;

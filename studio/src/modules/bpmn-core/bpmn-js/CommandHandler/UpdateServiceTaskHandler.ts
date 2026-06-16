import { getBusinessObject } from 'bpmn-js/lib/util/ModelUtil';
import type CommandStack from 'diagram-js/lib/command/CommandStack';

import { CmdHelper } from './Helper/CommmandHelper';
import { removeEvilExtension, setEvilBodyExtension } from './Utils/EvilExtensionHelper';

const EVIL_HTTP_URL = 'evil:HttpUrl';
const EVIL_HTTP_METHOD = 'evil:HttpMethod';
const EVIL_HTTP_BODY = 'evil:HttpBody';
const EVIL_HTTP_AUTH_HEADER = 'evil:HttpAuthHeader';
const EVIL_HTTP_RESPONSE_HEADERS = 'evil:HttpResponseHeaders';

const HTTP_EVIL_TYPES = [
  EVIL_HTTP_URL,
  EVIL_HTTP_METHOD,
  EVIL_HTTP_BODY,
  EVIL_HTTP_AUTH_HEADER,
  EVIL_HTTP_RESPONSE_HEADERS,
];

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
      for (const evilType of HTTP_EVIL_TYPES) {
        commands.push(...removeEvilExtension(element, evilType));
      }
    }

    const commandToExecute = CmdHelper.executeMultipleCommands(commands);
    this.commandStack.execute(commandToExecute.cmd, commandToExecute.context);
  };

  const updateHttpTask = (args: any): void => {
    const { element, newMethod, newUrl, newBody, newAuthHeader, newResponseHeaders } = args;
    const commands: any[] = [];

    commands.push(...setEvilBodyExtension(element, this.bpmnFactory, EVIL_HTTP_URL, newUrl));
    commands.push(...setEvilBodyExtension(element, this.bpmnFactory, EVIL_HTTP_METHOD, newMethod));
    commands.push(...setEvilBodyExtension(element, this.bpmnFactory, EVIL_HTTP_BODY, newBody));
    commands.push(...setEvilBodyExtension(element, this.bpmnFactory, EVIL_HTTP_AUTH_HEADER, newAuthHeader));
    commands.push(...setEvilBodyExtension(element, this.bpmnFactory, EVIL_HTTP_RESPONSE_HEADERS, newResponseHeaders));

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

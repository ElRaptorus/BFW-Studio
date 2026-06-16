import type { ProcessInstance } from '@elraptorus/daemonengine_sdk';

/** Debugger-local view of a process instance including the loaded BPMN XML. */
export type DebuggerProcessInstance = ProcessInstance & {
  xml: string;
  processModelId: string;
  version?: string;
};

export type DebuggerBaseError = {
  code?: string | number;
  message?: string;
  statusCode?: number;
  name?: string;
  stack?: string;
  additionalInformation?: unknown;
};

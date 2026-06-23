/**
 * Frozen command IDs and argument-shape types for all engine-core commands.
 *
 * Wave 2 modules MUST import command IDs from this file via the engine-core barrel
 * instead of hard-coding string literals. This ensures cross-module command references
 * stay in sync and enables compile-time detection of renamed or removed commands.
 *
 * FROZEN for Wave 2 parallel execution — do not rename or remove IDs without
 * coordinating all tracks.
 */
import type { RetryRequest, StartRequest, TriggerOptions } from '@elraptorus/daemonengine_sdk';

export const ENGINE_COMMANDS = {
  connect: 'engine.connect',
  connectWithDialog: 'engine.connectWithDialog',
  disconnect: 'engine.disconnect',
  removeFromHistory: 'engine.removeFromHistory',

  setAuthToken: 'engine.setAuthToken',

  deploy: 'engine.deploy',
  deployBatch: 'engine.deployBatch',

  startProcess: 'engine.startProcess',
  configuredStartProcess: 'engine.configuredStartProcess',
  startProcessAndOpenDebugger: 'engine.startProcessAndOpenDebugger',
  configuredStartProcessAndOpenDebugger: 'engine.configuredStartProcessAndOpenDebugger',

  abortProcessInstance: 'engine.abortProcessInstance',
  retryProcessInstance: 'engine.retryProcessInstance',
  deleteProcessInstance: 'engine.deleteProcessInstance',

  triggerMessage: 'engine.triggerMessage',
  triggerSignal: 'engine.triggerSignal',
  triggerTimerEvent: 'engine.triggerTimerEvent',
} as const;

export type EngineCommandId = (typeof ENGINE_COMMANDS)[keyof typeof ENGINE_COMMANDS];

export interface EngineCommandArgs {
  [ENGINE_COMMANDS.connect]: [url: string, displayName?: string];
  [ENGINE_COMMANDS.connectWithDialog]: [];
  [ENGINE_COMMANDS.disconnect]: [engineId: string];
  [ENGINE_COMMANDS.removeFromHistory]: [url: string];
  [ENGINE_COMMANDS.setAuthToken]: [engineUrl: string];
  [ENGINE_COMMANDS.deploy]: [engineId: string, fileContent: string, fileName: string];
  [ENGINE_COMMANDS.deployBatch]: [engineId: string, files: { content: string; name: string }[]];
  [ENGINE_COMMANDS.startProcess]: [engineId: string, processModelId: string, options?: StartRequest];
  [ENGINE_COMMANDS.configuredStartProcess]: [engineId: string, processModelId: string];
  [ENGINE_COMMANDS.startProcessAndOpenDebugger]: [engineId: string, processModelId: string];
  [ENGINE_COMMANDS.configuredStartProcessAndOpenDebugger]: [engineId: string, processModelId: string];
  [ENGINE_COMMANDS.abortProcessInstance]: [engineId: string, processInstanceId: string];
  [ENGINE_COMMANDS.retryProcessInstance]: [engineId: string, processInstanceId: string, options?: RetryRequest];
  [ENGINE_COMMANDS.deleteProcessInstance]: [engineId: string, processInstanceId: string];
  [ENGINE_COMMANDS.triggerMessage]: [
    engineId: string,
    messageName: string,
    payload: Record<string, unknown>,
    options?: TriggerOptions,
  ];
  [ENGINE_COMMANDS.triggerSignal]: [engineId: string, signalName: string];
  [ENGINE_COMMANDS.triggerTimerEvent]: [engineId: string, flowNodeInstanceId: string];
}

import type { Bifrost } from '#bifrost/Bifrost';
import type { DialogResult, DialogValidationResult } from '#bifrost/contracts/DialogTypes';
import { StandardDialogResponse } from '#bifrost/contracts/DialogTypes';

import type { StartResult } from '@elraptorus/bfw_engine_sdk';

import type { EngineConnectionManager } from '../EngineConnectionManager';
import { ENGINE_COMMANDS } from './CommandContract';

interface BpmnStartEvent {
  id: string;
  name: string | null;
  isPlain: boolean;
}

const BPMN_NS = 'http://www.omg.org/spec/BPMN/20100524/MODEL';

function getElementsByLocalName(parent: Element | Document, localName: string): Element[] {
  const nsMatches = parent instanceof Document ? parent.getElementsByTagNameNS(BPMN_NS, localName) : [];
  const directMatches = parent.getElementsByTagName(localName);
  const seen = new Set<Element>();
  const result: Element[] = [];
  for (const collection of [nsMatches, directMatches]) {
    for (let i = 0; i < collection.length; i++) {
      const element = collection[i];
      if (!seen.has(element)) {
        seen.add(element);
        result.push(element);
      }
    }
  }
  return result;
}

function hasChildByLocalName(parent: Element, localName: string): boolean {
  const nsMatches = parent.getElementsByTagNameNS(BPMN_NS, localName);
  if (nsMatches.length > 0) {
    return true;
  }
  return parent.getElementsByTagName(localName).length > 0;
}

function extractStartEventsFromXml(bpmnXml: string): BpmnStartEvent[] {
  const parser = new DOMParser();
  const document = parser.parseFromString(bpmnXml, 'application/xml');

  const startEventElements = getElementsByLocalName(document, 'startEvent');
  const startEvents: BpmnStartEvent[] = [];

  for (const element of startEventElements) {
    const parentElement = element.parentElement;
    const parentLocalName = parentElement?.localName;
    const isSubProcessEvent = parentLocalName === 'subProcess';
    const isEventSubProcess = parentElement?.getAttribute('triggeredByEvent') === 'true';
    if (isSubProcessEvent || isEventSubProcess) {
      continue;
    }

    startEvents.push({
      id: element.getAttribute('id') ?? '',
      name: element.getAttribute('name') ?? null,
      isPlain:
        !hasChildByLocalName(element, 'messageEventDefinition') &&
        !hasChildByLocalName(element, 'signalEventDefinition') &&
        !hasChildByLocalName(element, 'timerEventDefinition') &&
        !hasChildByLocalName(element, 'conditionalEventDefinition'),
    });
  }

  return startEvents.sort((eventA, eventB) => {
    const labelA = eventA.name ?? eventA.id;
    const labelB = eventB.name ?? eventB.id;
    return labelA.localeCompare(labelB);
  });
}

function smartParseValue(raw: string): unknown {
  if (raw === 'true') {
    return true;
  }
  if (raw === 'false') {
    return false;
  }
  if (raw === 'null') {
    return null;
  }
  if (raw !== '' && !isNaN(Number(raw)) && isFinite(Number(raw))) {
    return Number(raw);
  }
  return raw;
}

function parseBuilderEntries(raw: string | undefined): Record<string, unknown> | undefined {
  if (!raw) {
    return undefined;
  }

  let entries: { key: string; value: string }[];
  try {
    entries = JSON.parse(raw);
  } catch {
    return undefined;
  }

  const nonEmpty = entries.filter((entry) => entry.key.trim() !== '' || entry.value.trim() !== '');
  if (nonEmpty.length === 0) {
    return undefined;
  }

  const result: Record<string, unknown> = {};
  for (const entry of nonEmpty) {
    result[entry.key.trim()] = smartParseValue(entry.value);
  }
  return result;
}

function validateBuilderField(raw: string | undefined, contentId: string): { contentId: string; errorLabel: string }[] {
  if (!raw) {
    return [];
  }

  let entries: { key: string; value: string }[];
  try {
    entries = JSON.parse(raw);
  } catch {
    return [];
  }

  const errors: { contentId: string; errorLabel: string }[] = [];

  const nonEmptyEntries = entries.filter((entry) => entry.key.trim() !== '' || entry.value.trim() !== '');

  for (const entry of nonEmptyEntries) {
    if (entry.key.trim() && !entry.value.trim()) {
      errors.push({ contentId, errorLabel: `Key "${entry.key}" has no value` });
    }
    if (!entry.key.trim() && entry.value.trim()) {
      errors.push({ contentId, errorLabel: `A value is provided without a key` });
    }
  }

  const keys = nonEmptyEntries.map((entry) => entry.key.trim()).filter(Boolean);
  const duplicates = keys.filter((key, index) => keys.indexOf(key) !== index);
  const uniqueDuplicates = [...new Set(duplicates)];
  for (const duplicate of uniqueDuplicates) {
    errors.push({ contentId, errorLabel: `Duplicate key: "${duplicate}"` });
  }

  return errors;
}

export default function registerConfiguredStartCommands(
  bifrost: Bifrost,
  connectionManager: EngineConnectionManager,
): void {
  bifrost.commands.register(
    ENGINE_COMMANDS.configuredStartProcess,
    async (engineId: string, processModelId: string): Promise<StartResult | undefined> => {
      const connection = connectionManager.getConnection(engineId);
      if (!connection) {
        throw new Error(`Engine ${engineId} not connected`);
      }

      let startEvents: BpmnStartEvent[] = [];

      try {
        const processModel = await connection.client.processes.get(processModelId, { includeXml: true });
        const bpmnXml = processModel.bpmnXml ?? null;
        if (bpmnXml) {
          startEvents = extractStartEventsFromXml(bpmnXml);
        }
      } catch {
        // If we can't fetch start events, show the dialog with a text input instead
      }

      const firstPlainStartEvent = startEvents.find((startEvent) => startEvent.isPlain);

      const dialogContent: any[] = [];

      if (startEvents.length > 0) {
        dialogContent.push({
          type: 'select',
          id: 'startEventId',
          label: 'Start Event',
          value: firstPlainStartEvent?.id ?? startEvents[0].id,
          entries: startEvents.map((startEvent) => ({
            label: startEvent.name ?? startEvent.id,
            value: startEvent.id,
          })),
        });
      } else {
        dialogContent.push({
          type: 'text_input',
          id: 'startEventId',
          label: 'Start Event ID (optional)',
          value: '',
          optional: true,
        });
      }

      dialogContent.push(
        {
          type: 'key_value_builder',
          id: 'payload',
          label: 'Payload (optional)',
          keyPlaceholder: 'Key',
          valuePlaceholder: 'Value',
          optional: true,
          hint: 'Smart typing: true/false → boolean, numbers → number, null → null, rest → string',
        },
        {
          type: 'key_value_builder',
          id: 'context',
          label: 'Context Variables (optional)',
          keyPlaceholder: 'Variable name',
          valuePlaceholder: 'Value',
          optional: true,
          hint: 'Immutable variables accessible as context.* in FEEL expressions',
        },
        {
          type: 'text_input',
          id: 'businessKey',
          label: 'Business Key (optional)',
          value: '',
          optional: true,
        },
      );

      const processDisplayName = processModelId;

      const dialogResult = await bifrost.dialog.open(
        {
          title: `Configured Start: "${processDisplayName}"`,
          content: dialogContent,
          actions: [
            { label: 'Cancel', response: StandardDialogResponse.Cancel, cancel: true },
            { label: 'Start', response: StandardDialogResponse.Submit, default: true },
          ],
        },
        async (resultToValidate: DialogResult): Promise<DialogValidationResult> => {
          if (resultToValidate.wasCancelled || resultToValidate.response === 'cancel') {
            return { closeDialog: true };
          }

          const payloadErrors = validateBuilderField(resultToValidate.formData?.payload, 'payload');
          const contextErrors = validateBuilderField(resultToValidate.formData?.context, 'context');
          const allErrors = [...payloadErrors, ...contextErrors];

          if (allErrors.length > 0) {
            return { closeDialog: false, validationErrors: allErrors };
          }

          return { closeDialog: true };
        },
      );

      if (dialogResult.wasCancelled || dialogResult.response === 'cancel') {
        return undefined;
      }

      const startEventId = dialogResult.formData?.startEventId?.trim() || undefined;
      const businessKey = dialogResult.formData?.businessKey?.trim() || undefined;
      const payload = parseBuilderEntries(dialogResult.formData?.payload);
      const context = parseBuilderEntries(dialogResult.formData?.context);

      const result: StartResult = await bifrost.commands.executeCommand(ENGINE_COMMANDS.startProcess, [
        engineId,
        processModelId,
        { startEventId, payload, context, businessKey },
      ]);

      return result;
    },
    { enabledWhen: (engineId: string) => connectionManager.isConnected(engineId) },
  );

  bifrost.commands.register(
    ENGINE_COMMANDS.startProcessAndOpenDebugger,
    async (engineId: string, processModelId: string) => {
      const connection = connectionManager.getConnection(engineId);
      if (!connection) {
        throw new Error(`Engine ${engineId} not connected`);
      }

      let startEventCount = 0;
      try {
        const processModel = await connection.client.processes.get(processModelId, { includeXml: true });
        if (processModel.bpmnXml) {
          const startEvents = extractStartEventsFromXml(processModel.bpmnXml);
          startEventCount = startEvents.length;
        }
      } catch {
        // If we can't determine start events, try a direct start anyway
      }

      let result: StartResult | undefined;

      if (startEventCount === 1 || startEventCount === 0) {
        result = await bifrost.commands.executeCommand(ENGINE_COMMANDS.startProcess, [engineId, processModelId]);
      } else {
        result = await bifrost.commands.executeCommand(ENGINE_COMMANDS.configuredStartProcess, [
          engineId,
          processModelId,
        ]);
      }

      if (result?.processInstanceId) {
        await bifrost.commands.executeCommand('engine.debugger.focusOrOpen', [engineId, result.processInstanceId]);
      }
    },
    { enabledWhen: (engineId: string) => connectionManager.isConnected(engineId) },
  );

  bifrost.commands.register(
    ENGINE_COMMANDS.configuredStartProcessAndOpenDebugger,
    async (engineId: string, processModelId: string) => {
      const result: StartResult | undefined = await bifrost.commands.executeCommand(
        ENGINE_COMMANDS.configuredStartProcess,
        [engineId, processModelId],
      );

      if (result?.processInstanceId) {
        await bifrost.commands.executeCommand('engine.debugger.focusOrOpen', [engineId, result.processInstanceId]);
      }
    },
    { enabledWhen: (engineId: string) => connectionManager.isConnected(engineId) },
  );
}

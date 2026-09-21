import type { Bifrost } from '#bifrost/Bifrost';
import type { EngineConnectionManager } from '#modules/engine-core';

import type { ProcessModel } from '@elraptorus/bfw_engine_sdk';

import type { InstanceSearchDocumentModel } from '../models/InstanceSearchDocumentModel';

export async function toggleProcessEnabled(
  connectionManager: EngineConnectionManager,
  engineId: string,
  processModelId: string,
  enabled: boolean,
): Promise<void> {
  const client = connectionManager.getClient(engineId);
  if (!client) {
    throw new Error('Not connected');
  }
  if (enabled) {
    await client.processes.enable(processModelId);
  } else {
    await client.processes.disable(processModelId);
  }
}

export async function removeProcessFromEngine(
  connectionManager: EngineConnectionManager,
  engineId: string,
  processModelId: string,
): Promise<void> {
  const client = connectionManager.getClient(engineId);
  if (!client) {
    throw new Error('Not connected');
  }
  await client.processes.undeploy(processModelId);
}

export async function bulkToggleProcesses(
  connectionManager: EngineConnectionManager,
  engineId: string,
  models: ProcessModel[],
  enabled: boolean,
): Promise<void> {
  for (const model of models) {
    await toggleProcessEnabled(connectionManager, engineId, model.processModelId ?? model.id, enabled);
  }
}

export async function bulkRemoveProcesses(
  connectionManager: EngineConnectionManager,
  engineId: string,
  models: ProcessModel[],
): Promise<void> {
  for (const model of models) {
    await removeProcessFromEngine(connectionManager, engineId, model.processModelId ?? model.id);
  }
}

export function openModelViewer(studio: Bifrost, engineId: string, processModelId: string): void {
  studio.editors.focusOrOpenEditorDocument(`engine-model://${engineId}/${processModelId}`, processModelId);
}

export async function openInstanceSearch(
  studio: Bifrost,
  engineId: string,
  filter?: { processModelId?: string; version?: string; businessKey?: string },
): Promise<void> {
  const baseUri = `engine://instances/${engineId}`;

  let doc = studio.editors.getOpenEditorDocuments().find((existing) => existing.uri.startsWith(baseUri));

  if (!doc) {
    doc = studio.editors.focusOrOpenEditorDocument(baseUri, 'Instances');
  } else {
    studio.editors.focusOrOpenEditorDocument(doc.uri);
  }

  if (filter == null) {
    return;
  }

  const model = await studio.editors.getEditorDocumentModel<InstanceSearchDocumentModel>(doc);

  if (filter.processModelId) {
    model.setProcessModelIdFilter(filter.processModelId);
  }
  if (filter.version) {
    model.setVersionFilter(filter.version);
  }
  if (filter.businessKey) {
    model.setBusinessKeyFilter(filter.businessKey);
  }
}

export function openDecisionViewer(studio: Bifrost, engineId: string, decisionModelId: string): void {
  studio.editors.focusOrOpenEditorDocument(`engine-decision://${engineId}/${decisionModelId}`, decisionModelId);
}

import type { Bifrost } from '#bifrost/Bifrost';
import type { DialogContent } from '#bifrost/contracts/DialogTypes';
import { StandardDialogResponse } from '#bifrost/contracts/DialogTypes';

import type { RetryRequest } from '@elraptorus/bfw_engine_sdk';
import { IncompatibleVersionMigrationError, ProcessInstanceNotRetriableError } from '@elraptorus/bfw_engine_sdk';

import type { EngineConnectionManager } from '../EngineConnectionManager';
import { ENGINE_COMMANDS } from './CommandContract';

export interface RetryContext {
  processModelId?: string;
  currentVersion?: string;
  resetToFlowNodeInstanceId?: string;
  flowNodeName?: string;
}

export interface RetryResult {
  retried: boolean;
  retryRequest?: RetryRequest;
}

export default function registerConfiguredRetryCommands(
  bifrost: Bifrost,
  connectionManager: EngineConnectionManager,
): void {
  bifrost.commands.register(
    ENGINE_COMMANDS.configuredRetryProcessInstance,
    async (engineId: string, processInstanceId: string, context?: RetryContext): Promise<RetryResult | null> => {
      const connection = connectionManager.getConnection(engineId);
      if (!connection) {
        throw new Error(`Engine ${engineId} not connected`);
      }

      let versionEntries: { label: string; value: string }[] = [
        {
          label: `Same version${context?.currentVersion ? ` (${context.currentVersion})` : ''}`,
          value: '',
        },
        { label: 'Latest enabled version', value: 'latest' },
      ];

      if (context?.processModelId) {
        try {
          const versions = await connection.client.processes.getVersions(context.processModelId);
          const otherVersions = versions
            .filter((pm) => pm.version !== context.currentVersion)
            .map((pm) => ({
              label: `${pm.version ?? '(no version)'}${pm.enabled === false ? ' (disabled)' : ''}`,
              value: pm.version ?? '',
            }));
          versionEntries = [...versionEntries, ...otherVersions];
        } catch {
          // Version listing failed — proceed with default entries only
        }
      }

      const warningText = context?.flowNodeName
        ? `**Caution:** This will retry the process instance from **${context.flowNodeName}**. All flow node instances created after this checkpoint will be deleted. This action cannot be undone.`
        : `**Caution:** This will retry the process instance. This action cannot be undone.`;

      const content: DialogContent = [
        { type: 'markdown', text: warningText },
        { type: 'divider' },
        {
          type: 'select',
          id: 'targetVersion',
          label: 'Target Version',
          value: '',
          entries: versionEntries,
        },
      ];

      const dialogResult = await bifrost.dialog.open({
        title: 'Retry Process Instance',
        content,
        actions: [
          { label: 'Cancel', response: StandardDialogResponse.Cancel, cancel: true },
          { label: 'Retry', response: 'retry', dangerous: true, default: true },
        ],
      });

      if (dialogResult.wasCancelled || dialogResult.response === 'cancel') {
        return null;
      }

      const selectedVersion = dialogResult.formData?.targetVersion as string | undefined;
      const retryRequest: RetryRequest = {};

      if (context?.resetToFlowNodeInstanceId) {
        retryRequest.resetToFlowNodeInstanceId = context.resetToFlowNodeInstanceId;
      }
      if (selectedVersion && selectedVersion.length > 0) {
        retryRequest.version = selectedVersion;
      }

      try {
        await bifrost.commands.executeCommand(ENGINE_COMMANDS.retryProcessInstance, [
          engineId,
          processInstanceId,
          retryRequest,
        ]);
      } catch (error: unknown) {
        if (error instanceof IncompatibleVersionMigrationError) {
          bifrost.notifications.open({
            type: 'error',
            content: 'Version migration failed: the target version is not compatible with this process instance.',
            source: 'Engine',
          });
          return { retried: false };
        }
        if (error instanceof ProcessInstanceNotRetriableError) {
          bifrost.notifications.open({
            type: 'error',
            content: 'This process instance cannot be retried in its current state.',
            source: 'Engine',
          });
          return { retried: false };
        }
        throw error;
      }

      return { retried: true, retryRequest };
    },
    { enabledWhen: (engineId: string) => connectionManager.isConnected(engineId) },
  );
}

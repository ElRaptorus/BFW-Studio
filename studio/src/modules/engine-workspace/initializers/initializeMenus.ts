import type { Bifrost } from '#bifrost/Bifrost';
import type { EngineConnectionManager } from '#modules/engine-core';
import {
  ENGINE_COMMANDS,
  SETTINGS_KEYS,
  ensureProcessVersions,
  formatDeployErrorMessage,
  resolveVersionConflicts,
} from '#modules/engine-core';
import type { AutoRefreshInterval } from '#modules/engine-core';
import * as fs from 'fs/promises';
import * as path from 'path';

import type { Menu, MenuItem_Command } from '@elraptorus/bfw_studio_sdk';

import type { DecisionCatalogContextMetadata } from '../types/DecisionCatalogContext';
import type { InstanceSearchContextMetadata } from '../types/InstanceSearchContext';
import type { ProcessExplorerContextMetadata } from '../types/ProcessExplorerContext';
import type { TaskInboxContextMetadata } from '../types/TaskInboxContext';
import type { TimerSchedulesContextMetadata } from '../types/TimerSchedulesContext';
import {
  buildDecisionCatalogContextMenu,
  buildInstanceSearchContextMenu,
  buildProcessExplorerContextMenu,
  buildTaskInboxContextMenu,
  buildTimerSchedulesContextMenu,
} from './initializeCommands';

const DEPLOYABLE_EXTENSIONS = ['.bpmn', '.dmn'];

const INTERVAL_OPTIONS: { value: AutoRefreshInterval; label: string }[] = [
  { value: 'off', label: 'Off' },
  { value: '5s', label: '5 seconds' },
  { value: '10s', label: '10 seconds' },
  { value: '30s', label: '30 seconds' },
  { value: '1min', label: '1 minute' },
  { value: '5min', label: '5 minutes' },
];

function isDeployableUri(uri: string): boolean {
  const lower = uri.toLowerCase();
  return DEPLOYABLE_EXTENSIONS.some((extension) => lower.endsWith(extension));
}

function uriToFilePath(uri: string): string {
  if (uri.startsWith('file://')) {
    return uri.slice(7);
  }
  return uri;
}

export default function initializeMenus(bifrost: Bifrost, connectionManager: EngineConnectionManager): void {
  bifrost.commands.register('engine.workspace.deploySelectedFiles', async (uris: string[]) => {
    const activeEngineId = connectionManager.getActiveEngineId();
    if (!activeEngineId) {
      bifrost.notifications.open({
        type: 'warning',
        content: 'No engine connected. Connect an engine first.',
        source: 'Engine',
      });
      return;
    }

    const deployableUris = uris.filter(isDeployableUri);
    if (deployableUris.length === 0) {
      bifrost.notifications.open({
        type: 'info',
        content: 'No BPMN or DMN files in the selection.',
        source: 'Engine',
      });
      return;
    }

    const client = connectionManager.getClient(activeEngineId);
    const connection = connectionManager.getConnection(activeEngineId);
    const engineLabel = connection?.displayName ?? activeEngineId;

    const filesToDeploy: { filePath: string; content: string; name: string }[] = [];
    for (const uri of deployableUris) {
      const filePath = uriToFilePath(uri);
      let content = await fs.readFile(filePath, 'utf-8');
      const fileName = path.basename(filePath);

      if (fileName.toLowerCase().endsWith('.bpmn')) {
        const checked = await ensureProcessVersions(content, bifrost, client);
        if (checked == null) {
          return;
        }
        if (checked.modified) {
          await fs.writeFile(filePath, checked.xml, 'utf-8');
          content = checked.xml;
        }
      }

      filesToDeploy.push({ filePath, content, name: fileName });
    }

    let deployedCount = 0;
    let lastDeployedItem: { processModelId?: string; decisionDefinitionId?: string } | null = null;
    let aborted = false;

    for (const file of filesToDeploy) {
      if (aborted) {
        break;
      }

      const maxConflictRetries = 3;
      let currentContent = file.content;
      let deployed = false;

      for (let attempt = 0; attempt <= maxConflictRetries; attempt++) {
        try {
          const result: any = await bifrost.commands.executeCommand(ENGINE_COMMANDS.deploy, [
            activeEngineId,
            currentContent,
            file.name,
          ]);
          const item = extractSingleDeployedItem(result, file.name.toLowerCase().endsWith('.dmn'));
          if (item) {
            lastDeployedItem = item;
          }
          deployedCount++;
          deployed = true;
          break;
        } catch (deployError: any) {
          if (deployError?.errorCode === 'version_exists' && Array.isArray(deployError?.conflicts)) {
            const resolved = await resolveVersionConflicts(currentContent, deployError.conflicts, bifrost, client);
            if (resolved == null) {
              aborted = true;
              break;
            }
            if ('runExisting' in resolved) {
              aborted = true;
              break;
            }
            await fs.writeFile(file.filePath, resolved.xml, 'utf-8');
            currentContent = resolved.xml;
            continue;
          }
          bifrost.notifications.open({
            type: 'error',
            content: formatDeployErrorMessage(deployError),
            source: 'Engine',
          });
          aborted = true;
          break;
        }
      }

      if (!deployed && !aborted) {
        bifrost.notifications.open({
          type: 'error',
          content: `Deployment of "${file.name}" failed after multiple version-conflict retries.`,
          source: 'Engine',
        });
        aborted = true;
      }
    }

    if (deployedCount === 0) {
      return;
    }

    const hasBpmn = filesToDeploy.some((file) => !file.name.toLowerCase().endsWith('.dmn'));
    const hasDmn = filesToDeploy.some((file) => file.name.toLowerCase().endsWith('.dmn'));
    const onlyDmn = hasDmn && !hasBpmn;

    if (filesToDeploy.length === 1) {
      const notificationId = bifrost.notifications.open(
        {
          type: 'info',
          content: `Deployed "${filesToDeploy[0].name}" to ${engineLabel}.`,
          source: 'Engine',
          actions: [{ action: 'view', label: 'View on Engine', default: true }],
        },
        (response) => {
          if (response.action !== 'view') {
            return;
          }
          bifrost.notifications.close(notificationId);
          if (onlyDmn && lastDeployedItem?.decisionDefinitionId) {
            bifrost.commands.executeCommand('engine.workspace.openDecisionViewer', [
              activeEngineId,
              lastDeployedItem.decisionDefinitionId,
            ]);
          } else if (lastDeployedItem?.processModelId) {
            bifrost.commands.executeCommand('engine.workspace.openModelViewer', [
              activeEngineId,
              lastDeployedItem.processModelId,
            ]);
          }
        },
      );
    } else {
      const viewCommand = onlyDmn ? 'engine.workspace.openDecisionCatalog' : 'engine.workspace.openProcessExplorer';
      const notificationId = bifrost.notifications.open(
        {
          type: 'info',
          content: `Deployed ${deployedCount} of ${filesToDeploy.length} files to ${engineLabel}.`,
          source: 'Engine',
          actions: [{ action: 'view', label: 'View on Engine', default: true }],
        },
        (response) => {
          if (response.action !== 'view') {
            return;
          }
          bifrost.notifications.close(notificationId);
          bifrost.commands.executeCommand(viewCommand, [activeEngineId]);
        },
      );
    }
  });

  bifrost.menus.registerMenuModifier('std/file-explorer/file', (menu: Menu, metadata: any) => {
    if (!metadata?.uri || !isDeployableUri(metadata.uri)) {
      return menu;
    }

    if (!canDeploy(connectionManager)) {
      return menu;
    }

    return insertDeployGroupAfterDivider(bifrost, menu, 'std/file-explorer/file/divider-before-compare-to', {
      type: 'command',
      label: 'Deploy to Engine',
      id: 'engine-workspace/file/deploy',
      icon: 'ph ph-upload',
      command: 'engine.workspace.deploySelectedFiles',
      commandArgs: [[metadata.uri]],
    });
  });

  bifrost.menus.registerMenuModifier('std/file-explorer/directory', (menu: Menu, metadata: any) => {
    if (!metadata?.uri) {
      return menu;
    }

    if (!canDeploy(connectionManager)) {
      return menu;
    }

    return insertDeployGroupAfterDivider(bifrost, menu, 'std/file-explorer/directory/divider-before-rename', {
      type: 'command',
      label: 'Deploy folder to Engine',
      id: 'engine-workspace/directory/deploy',
      icon: 'ph ph-upload',
      command: 'engine.workspace.deployDirectory',
      commandArgs: [metadata.uri],
    });
  });

  bifrost.menus.registerMenuModifier('std/file-explorer/project', (menu: Menu, metadata: any) => {
    if (!metadata?.uri) {
      return menu;
    }

    if (!canDeploy(connectionManager)) {
      return menu;
    }

    return insertDeployGroupAfterDivider(bifrost, menu, 'std/file-explorer/project/divider-before-rename-project', {
      type: 'command',
      label: 'Deploy project to Engine',
      id: 'engine-workspace/project/deploy',
      icon: 'ph ph-upload',
      command: 'engine.workspace.deployDirectory',
      commandArgs: [metadata.uri],
    });
  });

  bifrost.menus.registerMenuModifier('std/file-explorer/solution-root', (menu: Menu, metadata: any) => {
    if (!metadata?.uri) {
      return menu;
    }

    if (!canDeploy(connectionManager)) {
      return menu;
    }

    return insertDeployGroupAfterDivider(bifrost, menu, 'std/file-explorer/solution-root/divider-before-rename', {
      type: 'command',
      label: 'Deploy folder to Engine',
      id: 'engine-workspace/solution-root/deploy',
      icon: 'ph ph-upload',
      command: 'engine.workspace.deployDirectory',
      commandArgs: [metadata.uri],
    });
  });

  bifrost.menus.registerMenuModifier('std/file-explorer/multi-selection', (menu: Menu, selectedMetadata: any[]) => {
    if (!canDeploy(connectionManager)) {
      return menu;
    }

    const deployableUris: string[] = (selectedMetadata ?? [])
      .filter((meta: any) => meta?.type === 'file' && meta?.uri && isDeployableUri(meta.uri))
      .map((meta: any) => meta.uri);

    if (deployableUris.length === 0) {
      return menu;
    }

    return insertDeployGroupAfterDivider(bifrost, menu, 'std/file-explorer/multi-selection/divider-before-delete', {
      type: 'command',
      label: `Deploy ${deployableUris.length} file${deployableUris.length > 1 ? 's' : ''} to Engine`,
      id: 'engine-workspace/multi-selection/deploy',
      icon: 'ph ph-upload',
      command: 'engine.workspace.deploySelectedFiles',
      commandArgs: [deployableUris],
    });
  });

  for (const option of INTERVAL_OPTIONS) {
    bifrost.commands.register(`engine.workspace.setRefreshInterval.${option.value}`, () => {
      bifrost.settings.set(SETTINGS_KEYS.dashboardAutoRefresh, option.value);
    });
  }

  bifrost.menus.registerMenu('engine-workspace/refresh-interval', (): Menu => {
    const current: AutoRefreshInterval = bifrost.settings.get(SETTINGS_KEYS.dashboardAutoRefresh) ?? '30s';
    return INTERVAL_OPTIONS.map((option) => ({
      type: 'command' as const,
      label: option.label,
      id: `engine-workspace/refresh-interval/${option.value}`,
      checked: current === option.value,
      command: `engine.workspace.setRefreshInterval.${option.value}`,
    }));
  });

  for (const option of INTERVAL_OPTIONS) {
    bifrost.commands.register(`engine.workspace.setTaskInboxRefreshInterval.${option.value}`, () => {
      bifrost.settings.set(SETTINGS_KEYS.taskInboxAutoRefresh, option.value);
    });
  }

  bifrost.menus.registerMenu('engine-workspace/task-inbox/refresh-interval', (): Menu => {
    const current: AutoRefreshInterval = bifrost.settings.get(SETTINGS_KEYS.taskInboxAutoRefresh) ?? '30s';
    return INTERVAL_OPTIONS.map((option) => ({
      type: 'command' as const,
      label: option.label,
      id: `engine-workspace/task-inbox/refresh-interval/${option.value}`,
      checked: current === option.value,
      command: `engine.workspace.setTaskInboxRefreshInterval.${option.value}`,
    }));
  });

  for (const option of INTERVAL_OPTIONS) {
    bifrost.commands.register(`engine.workspace.setProcessExplorerRefreshInterval.${option.value}`, () => {
      bifrost.settings.set(SETTINGS_KEYS.processExplorerAutoRefresh, option.value);
    });
  }

  bifrost.menus.registerMenu('engine-workspace/process-explorer/refresh-interval', (): Menu => {
    const current: AutoRefreshInterval = bifrost.settings.get(SETTINGS_KEYS.processExplorerAutoRefresh) ?? '30s';
    return INTERVAL_OPTIONS.map((option) => ({
      type: 'command' as const,
      label: option.label,
      id: `engine-workspace/process-explorer/refresh-interval/${option.value}`,
      checked: current === option.value,
      command: `engine.workspace.setProcessExplorerRefreshInterval.${option.value}`,
    }));
  });

  for (const option of INTERVAL_OPTIONS) {
    bifrost.commands.register(`engine.workspace.setDecisionCatalogRefreshInterval.${option.value}`, () => {
      bifrost.settings.set(SETTINGS_KEYS.decisionCatalogAutoRefresh, option.value);
    });
  }

  bifrost.menus.registerMenu('engine-workspace/decision-catalog/refresh-interval', (): Menu => {
    const current: AutoRefreshInterval = bifrost.settings.get(SETTINGS_KEYS.decisionCatalogAutoRefresh) ?? '30s';
    return INTERVAL_OPTIONS.map((option) => ({
      type: 'command' as const,
      label: option.label,
      id: `engine-workspace/decision-catalog/refresh-interval/${option.value}`,
      checked: current === option.value,
      command: `engine.workspace.setDecisionCatalogRefreshInterval.${option.value}`,
    }));
  });

  for (const option of INTERVAL_OPTIONS) {
    bifrost.commands.register(`engine.workspace.setInstanceSearchRefreshInterval.${option.value}`, () => {
      bifrost.settings.set(SETTINGS_KEYS.instanceSearchAutoRefresh, option.value);
    });
  }

  bifrost.menus.registerMenu('engine-workspace/instance-search/refresh-interval', (): Menu => {
    const current: AutoRefreshInterval = bifrost.settings.get(SETTINGS_KEYS.instanceSearchAutoRefresh) ?? '30s';
    return INTERVAL_OPTIONS.map((option) => ({
      type: 'command' as const,
      label: option.label,
      id: `engine-workspace/instance-search/refresh-interval/${option.value}`,
      checked: current === option.value,
      command: `engine.workspace.setInstanceSearchRefreshInterval.${option.value}`,
    }));
  });

  for (const option of INTERVAL_OPTIONS) {
    bifrost.commands.register(`engine.workspace.setTimerSchedulesRefreshInterval.${option.value}`, () => {
      bifrost.settings.set(SETTINGS_KEYS.timerSchedulesAutoRefresh, option.value);
    });
  }

  bifrost.menus.registerMenu('engine-workspace/timer-schedules/refresh-interval', (): Menu => {
    const current: AutoRefreshInterval = bifrost.settings.get(SETTINGS_KEYS.timerSchedulesAutoRefresh) ?? '30s';
    return INTERVAL_OPTIONS.map((option) => ({
      type: 'command' as const,
      label: option.label,
      id: `engine-workspace/timer-schedules/refresh-interval/${option.value}`,
      checked: current === option.value,
      command: `engine.workspace.setTimerSchedulesRefreshInterval.${option.value}`,
    }));
  });

  bifrost.menus.registerMenu(
    'engine-workspace/process-explorer/contextmenu',
    (metadata: ProcessExplorerContextMetadata, studio: Bifrost): Menu => {
      return buildProcessExplorerContextMenu(studio, metadata);
    },
  );

  bifrost.menus.registerMenu(
    'engine-workspace/decision-catalog/contextmenu',
    (metadata: DecisionCatalogContextMetadata, studio: Bifrost): Menu => {
      return buildDecisionCatalogContextMenu(studio, metadata);
    },
  );

  bifrost.menus.registerMenu(
    'engine-workspace/instance-search/contextmenu',
    (metadata: InstanceSearchContextMetadata, studio: Bifrost): Menu => {
      return buildInstanceSearchContextMenu(studio, metadata);
    },
  );

  bifrost.menus.registerMenu(
    'engine-workspace/timer-schedules/contextmenu',
    (metadata: TimerSchedulesContextMetadata, studio: Bifrost): Menu => {
      return buildTimerSchedulesContextMenu(studio, metadata);
    },
  );

  bifrost.menus.registerMenu(
    'engine-workspace/task-inbox/contextmenu',
    (metadata: TaskInboxContextMetadata, studio: Bifrost): Menu => {
      return buildTaskInboxContextMenu(studio, metadata);
    },
  );

  bifrost.menus.registerMenu('engine-workspace/sidebar/engine', (metadata: any): Menu => {
    return [
      {
        type: 'command',
        label: 'Disconnect',
        id: 'engine-workspace/sidebar/engine/disconnect',
        command: ENGINE_COMMANDS.disconnect,
        commandArgs: [metadata.engineId],
      },
      {
        type: 'command',
        label: 'Disconnect & Remove',
        id: 'engine-workspace/sidebar/engine/disconnect-and-remove',
        command: ENGINE_COMMANDS.removeFromHistory,
        commandArgs: [metadata.engineUrl],
      },
    ];
  });

  bifrost.menus.registerMenu('engine-workspace/sidebar/recent', (metadata: any): Menu => {
    return [
      {
        type: 'command',
        label: 'Connect',
        id: 'engine-workspace/sidebar/recent/connect',
        command: ENGINE_COMMANDS.connect,
        commandArgs: [metadata.engineUrl],
      },
      { type: 'divider' },
      {
        type: 'command',
        label: 'Remove from List',
        id: 'engine-workspace/sidebar/recent/remove',
        command: ENGINE_COMMANDS.removeFromHistory,
        commandArgs: [metadata.engineUrl],
      },
    ];
  });

  bifrost.menus.registerMenu('engine-workspace/sidebar/page', (metadata: any): Menu => {
    const resolved = resolvePageUriForMenu(metadata.action, metadata.engineId);

    return [
      ...(resolved
        ? [
            {
              type: 'command' as const,
              label: 'Open to the Side',
              id: 'engine-workspace/sidebar/page/open-to-side',
              command: 'std.editor.openDocumentToTheSide',
              commandArgs: [resolved.uri, resolved.title],
            },
            { type: 'divider' as const },
          ]
        : []),
      {
        type: 'command',
        label: 'Disconnect',
        id: 'engine-workspace/sidebar/page/disconnect',
        command: ENGINE_COMMANDS.disconnect,
        commandArgs: [metadata.engineId],
      },
      {
        type: 'command',
        label: 'Disconnect & Remove',
        id: 'engine-workspace/sidebar/page/disconnect-and-remove',
        command: ENGINE_COMMANDS.removeFromHistory,
        commandArgs: [metadata.engineUrl],
      },
    ];
  });

  bifrost.commands.register('engine.workspace.deployDirectory', async (directoryUri: string): Promise<void> => {
    const dirPath = uriToFilePath(directoryUri);
    const entries = await fs.readdir(dirPath, { withFileTypes: true });
    const deployableUris: string[] = [];

    for (const entry of entries) {
      if (entry.isFile() && isDeployableUri(entry.name)) {
        deployableUris.push(`file://${path.join(dirPath, entry.name)}`);
      }
    }

    if (deployableUris.length === 0) {
      bifrost.notifications.open({
        type: 'info',
        content: 'No BPMN or DMN files found in this directory.',
        source: 'Engine',
      });
      return;
    }

    await bifrost.commands.executeCommand('engine.workspace.deploySelectedFiles', [deployableUris]);
  });
}

function insertDeployGroupAfterDivider(
  bifrost: Bifrost,
  menu: Menu,
  dividerId: string,
  deployItem: MenuItem_Command & { id: string },
): Menu {
  return bifrost.menus.insertAfterMenuItem(menu, dividerId, [
    deployItem,
    { type: 'divider', id: `${deployItem.id}/trailing-divider` },
  ]);
}

function canDeploy(connectionManager: EngineConnectionManager): boolean {
  const activeEngineId = connectionManager.getActiveEngineId();
  return activeEngineId != null && connectionManager.isConnected(activeEngineId);
}

const PAGE_URI_MAP: Record<string, { uriFactory: (id: string) => string; title: string }> = {
  'open-dashboard': { uriFactory: (id) => `engine://dashboard/${id}`, title: 'Dashboard' },
  'open-processes': { uriFactory: (id) => `engine://processes/${id}`, title: 'Processes' },
  'open-decisions': { uriFactory: (id) => `engine://decisions/${id}`, title: 'Decisions' },
  'open-task-inbox': { uriFactory: (id) => `engine-task-inbox://${id}`, title: 'Task Inbox' },
  'open-instances': { uriFactory: (id) => `engine://instances/${id}`, title: 'Instances' },
  'open-timers': { uriFactory: (id) => `engine://timers/${id}`, title: 'Timers' },
};

function resolvePageUriForMenu(action: string, engineId: string): { uri: string; title: string } | null {
  const entry = PAGE_URI_MAP[action];
  if (!entry) {
    return null;
  }
  return { uri: entry.uriFactory(engineId), title: entry.title };
}

function extractSingleDeployedItem(
  result: any,
  isDmn: boolean,
): { processModelId?: string; decisionDefinitionId?: string } | null {
  const results = Array.isArray(result) ? result : [result];
  for (const chunk of results) {
    const deployed = chunk?.deployed;
    if (Array.isArray(deployed) && deployed.length > 0) {
      const item = deployed[0];
      if (isDmn && item?.decisionDefinitionId) {
        return { decisionDefinitionId: item.decisionDefinitionId };
      }
      if (!isDmn && item?.processModelId) {
        return { processModelId: item.processModelId };
      }
    }
  }
  return null;
}

import type { Bifrost } from '#bifrost/Bifrost';
import type { MenuBarItemMap } from '#bifrost/contracts/MenuBarTypes';
import type { EngineConnectionManager } from '#modules/engine-core';
import { ENGINE_COMMANDS, formatDeployErrorMessage } from '#modules/engine-core';
import * as fs from 'fs/promises';
import * as path from 'path';

import type { CommandContext, Menu, MenuItem } from '@evil/bifrost_fw_sdk';

import { ensureProcessVersions, resolveVersionConflicts } from '../helpers/versionUtils';

const DEPLOYABLE_EXTENSIONS = ['.bpmn', '.dmn'];

function isFocusedDocumentDeployable(bifrost: Bifrost): boolean {
  const doc = bifrost.editors.getFocusedEditorDocument();
  if (!doc?.uri) {
    return false;
  }
  const lower = doc.uri.toLowerCase();
  return DEPLOYABLE_EXTENSIONS.some((extension) => lower.endsWith(extension));
}

function isFocusedDocumentBpmn(bifrost: Bifrost): boolean {
  const doc = bifrost.editors.getFocusedEditorDocument();
  if (!doc?.uri) {
    return false;
  }
  return doc.uri.toLowerCase().endsWith('.bpmn');
}

function isFocusedDocumentModelViewer(bifrost: Bifrost): boolean {
  const doc = bifrost.editors.getFocusedEditorDocument();
  return doc?.documentType === 'engine-model-viewer';
}

function isActiveEngineOnline(connectionManager: EngineConnectionManager): boolean {
  const activeEngineId = connectionManager.getActiveEngineId();
  return activeEngineId != null && connectionManager.isConnected(activeEngineId);
}

function isDeployEnabled(bifrost: Bifrost, connectionManager: EngineConnectionManager): boolean {
  return isActiveEngineOnline(connectionManager) && isFocusedDocumentDeployable(bifrost);
}

function isStartEnabled(bifrost: Bifrost, connectionManager: EngineConnectionManager): boolean {
  if (!isActiveEngineOnline(connectionManager)) {
    return false;
  }
  return isFocusedDocumentBpmn(bifrost) || isFocusedDocumentModelViewer(bifrost);
}

function extractProcessModelIdFromModelViewerUri(uri: string): string | null {
  const match = uri.match(/^engine-model:\/\/[^/]+\/(.+)$/);
  return match?.[1] ?? null;
}

function formatEngineLabel(connection: { displayName: string | null; url: string; state?: string }): string {
  const name = connection.displayName ?? connection.url;
  if (connection.state && connection.state !== 'connected') {
    return `[OFFLINE] ${name}`;
  }
  return name;
}

interface BpmnDeployResult {
  processModelId: string;
  engineId: string;
  filePath: string;
  fileName: string;
}

/**
 * Shared BPMN deploy pipeline: read file, ensure versions, deploy with
 * version-conflict retry loop. Returns null when the user cancels a dialog
 * or an unrecoverable error occurs.
 */
async function deployFocusedBpmnFile(
  bifrost: Bifrost,
  connectionManager: EngineConnectionManager,
): Promise<BpmnDeployResult | null> {
  const doc = bifrost.editors.getFocusedEditorDocument();
  if (!doc?.uri) {
    return null;
  }

  const activeEngineId = connectionManager.getActiveEngineId();
  if (!activeEngineId) {
    bifrost.notifications.open({ type: 'warning', content: 'No engine connected.', source: 'Engine' });
    return null;
  }

  const filePath = doc.uri.startsWith('file://') ? doc.uri.slice(7) : doc.uri;
  const fileName = path.basename(filePath);

  if (!fileName.toLowerCase().endsWith('.bpmn')) {
    bifrost.notifications.open({
      type: 'info',
      content: 'This action is only available for BPMN files.',
      source: 'Engine',
    });
    return null;
  }

  let content = await fs.readFile(filePath, 'utf-8');

  const client = connectionManager.getClient(activeEngineId);
  const checked = await ensureProcessVersions(content, bifrost, client);
  if (checked == null) {
    return null;
  }
  if (checked.modified) {
    await fs.writeFile(filePath, checked.xml, 'utf-8');
  }
  content = checked.xml;

  const maxConflictRetries = 3;
  for (let attempt = 0; attempt <= maxConflictRetries; attempt++) {
    try {
      const result: any = await bifrost.commands.executeCommand(ENGINE_COMMANDS.deploy, [
        activeEngineId,
        content,
        fileName,
      ]);
      const processModelId: string | null = result?.deployed?.[0]?.processModelId ?? null;
      if (!processModelId) {
        bifrost.notifications.open({
          type: 'error',
          content: 'Deploy succeeded but the engine did not return a process model ID.',
          source: 'Engine',
        });
        return null;
      }
      return { processModelId, engineId: activeEngineId, filePath, fileName };
    } catch (deployError: any) {
      if (deployError?.errorCode === 'version_exists' && Array.isArray(deployError?.conflicts)) {
        const resolved = await resolveVersionConflicts(content, deployError.conflicts, bifrost, client);
        if (resolved == null) {
          return null;
        }
        await fs.writeFile(filePath, resolved.xml, 'utf-8');
        content = resolved.xml;
        continue;
      }
      bifrost.notifications.open({
        type: 'error',
        content: formatDeployErrorMessage(deployError),
        source: 'Engine',
      });
      return null;
    }
  }

  bifrost.notifications.open({
    type: 'error',
    content: 'Deployment failed after multiple version-conflict retries.',
    source: 'Engine',
  });
  return null;
}

export default function initializeRunMenu(bifrost: Bifrost, connectionManager: EngineConnectionManager): void {
  // ─── Deploy commands ───────────────────────────────────────────────

  bifrost.commands.register(
    'engine.deployCurrentProcess',
    async () => {
      const doc = bifrost.editors.getFocusedEditorDocument();
      if (!doc?.uri) {
        return;
      }

      const activeEngineId = connectionManager.getActiveEngineId();
      if (!activeEngineId) {
        bifrost.notifications.open({ type: 'warning', content: 'No engine connected.', source: 'Engine' });
        return;
      }

      const filePath = doc.uri.startsWith('file://') ? doc.uri.slice(7) : doc.uri;
      const fileName = path.basename(filePath);
      const isDmn = fileName.toLowerCase().endsWith('.dmn');

      if (isDmn) {
        const content = await fs.readFile(filePath, 'utf-8');
        const connection = connectionManager.getConnection(activeEngineId);
        const engineLabel = connection?.displayName ?? activeEngineId;
        try {
          const result: any = await bifrost.commands.executeCommand(ENGINE_COMMANDS.deploy, [
            activeEngineId,
            content,
            fileName,
          ]);
          const deployed = result?.deployed?.[0];
          const modelId = deployed?.decisionDefinitionId;
          const notificationId = bifrost.notifications.open(
            {
              type: 'info',
              content: `Deployed "${fileName}" to ${engineLabel}.`,
              source: 'Engine',
              actions: modelId ? [{ action: 'view', label: 'View on Engine', default: true }] : [],
            },
            (response) => {
              if (response.action !== 'view' || !modelId) {
                return;
              }
              bifrost.notifications.close(notificationId);
              bifrost.commands.executeCommand('engine.workspace.openDecisionViewer', [activeEngineId, modelId]);
            },
          );
        } catch (error: any) {
          bifrost.notifications.open({
            type: 'error',
            content: formatDeployErrorMessage(error),
            source: 'Engine',
          });
        }
        return;
      }

      const deployResult = await deployFocusedBpmnFile(bifrost, connectionManager);
      if (!deployResult) {
        return;
      }

      const connection = connectionManager.getConnection(deployResult.engineId);
      const engineLabel = connection?.displayName ?? deployResult.engineId;
      const notificationId = bifrost.notifications.open(
        {
          type: 'info',
          content: `Deployed "${deployResult.fileName}" to ${engineLabel}.`,
          source: 'Engine',
          actions: [{ action: 'view', label: 'View on Engine', default: true }],
        },
        (response) => {
          if (response.action !== 'view') {
            return;
          }
          bifrost.notifications.close(notificationId);
          bifrost.commands.executeCommand('engine.workspace.openModelViewer', [
            deployResult.engineId,
            deployResult.processModelId,
          ]);
        },
      );
    },
    { enabledWhen: () => isDeployEnabled(bifrost, connectionManager) },
  );

  bifrost.commands.register(
    'engine.deployAndOpenCurrentProcess',
    async () => {
      const doc = bifrost.editors.getFocusedEditorDocument();
      if (!doc?.uri) {
        return;
      }

      const activeEngineId = connectionManager.getActiveEngineId();
      if (!activeEngineId) {
        bifrost.notifications.open({ type: 'warning', content: 'No engine connected.', source: 'Engine' });
        return;
      }

      const filePath = doc.uri.startsWith('file://') ? doc.uri.slice(7) : doc.uri;
      const fileName = path.basename(filePath);
      const isDmn = fileName.toLowerCase().endsWith('.dmn');

      if (isDmn) {
        const content = await fs.readFile(filePath, 'utf-8');
        try {
          const result: any = await bifrost.commands.executeCommand(ENGINE_COMMANDS.deploy, [
            activeEngineId,
            content,
            fileName,
          ]);
          const deployed = result?.deployed?.[0];
          const modelId = deployed?.decisionDefinitionId;
          if (modelId) {
            await bifrost.commands.executeCommand('engine.workspace.openDecisionViewer', [activeEngineId, modelId]);
          }
        } catch (error: any) {
          bifrost.notifications.open({
            type: 'error',
            content: formatDeployErrorMessage(error),
            source: 'Engine',
          });
        }
        return;
      }

      const deployResult = await deployFocusedBpmnFile(bifrost, connectionManager);
      if (!deployResult) {
        return;
      }

      await bifrost.commands.executeCommand('engine.workspace.openModelViewer', [
        deployResult.engineId,
        deployResult.processModelId,
      ]);
    },
    { enabledWhen: () => isDeployEnabled(bifrost, connectionManager) },
  );

  bifrost.commands.register(
    'engine.deploySolution',
    async () => {
      const activeEngineId = connectionManager.getActiveEngineId();
      if (!activeEngineId) {
        bifrost.notifications.open({ type: 'warning', content: 'No engine connected.', source: 'Engine' });
        return;
      }

      const solution = bifrost.solution.getSolution();
      if (!solution) {
        bifrost.notifications.open({ type: 'warning', content: 'No solution open.', source: 'Engine' });
        return;
      }

      const files: { content: string; name: string; filePath?: string }[] = [];
      for (const project of solution.projects) {
        const projectPath = project.baseUri.startsWith('file://') ? project.baseUri.slice(7) : project.baseUri;
        await collectDeployableFiles(projectPath, files);
      }

      if (files.length === 0) {
        bifrost.notifications.open({
          type: 'info',
          content: 'No BPMN or DMN files found in the solution.',
          source: 'Engine',
        });
        return;
      }

      const client = connectionManager.getClient(activeEngineId);

      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        if (!file.name.toLowerCase().endsWith('.bpmn')) {
          continue;
        }
        const checked = await ensureProcessVersions(file.content, bifrost, client);
        if (checked == null) {
          return;
        }
        if (checked.modified) {
          file.content = checked.xml;
          if (file.filePath) {
            await fs.writeFile(file.filePath, checked.xml, 'utf-8');
          }
        }
      }

      const connection = connectionManager.getConnection(activeEngineId);
      const engineLabel = connection?.displayName ?? activeEngineId;
      const hasBpmn = files.some((file) => !file.name.toLowerCase().endsWith('.dmn'));
      const hasDmn = files.some((file) => file.name.toLowerCase().endsWith('.dmn'));
      const onlyDmn = hasDmn && !hasBpmn;
      const viewCommand = onlyDmn ? 'engine.workspace.openDecisionCatalog' : 'engine.workspace.openProcessExplorer';

      try {
        await bifrost.commands.executeCommand(ENGINE_COMMANDS.deployBatch, [activeEngineId, files]);
        const notificationId = bifrost.notifications.open(
          {
            type: 'info',
            content: `Deployed ${files.length} file${files.length > 1 ? 's' : ''} from solution to ${engineLabel}.`,
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
      } catch (error: any) {
        bifrost.notifications.open({
          type: 'error',
          content: formatDeployErrorMessage(error),
          source: 'Engine',
        });
      }
    },
    { enabledWhen: () => isActiveEngineOnline(connectionManager) },
  );

  // ─── Quick Deploy & Start (F5) ────────────────────────────────────

  bifrost.commands.register(
    'engine.quickDeployAndDebug',
    async () => {
      const deployResult = await deployFocusedBpmnFile(bifrost, connectionManager);
      if (!deployResult) {
        return;
      }

      try {
        await bifrost.commands.executeCommand(ENGINE_COMMANDS.startProcessAndOpenDebugger, [
          deployResult.engineId,
          deployResult.processModelId,
        ]);
      } catch (startError: any) {
        bifrost.notifications.open({
          type: 'error',
          content: `Start failed: ${startError?.message ?? String(startError)}`,
          source: 'Engine',
        });
      }
    },
    {
      visibleInSearch: true,
      description: ['Engine: Start in Debugger', 'Engine Quick Deploy & Start'],
      enabledWhen: () => isDeployEnabled(bifrost, connectionManager),
    },
  );

  // ─── Quick Deploy & Configured Start (Shift+F5) ───────────────────

  bifrost.commands.register(
    'engine.quickDeployAndConfiguredDebug',
    async () => {
      const deployResult = await deployFocusedBpmnFile(bifrost, connectionManager);
      if (!deployResult) {
        return;
      }

      try {
        await bifrost.commands.executeCommand(ENGINE_COMMANDS.configuredStartProcessAndOpenDebugger, [
          deployResult.engineId,
          deployResult.processModelId,
        ]);
      } catch (startError: any) {
        bifrost.notifications.open({
          type: 'error',
          content: `Configured Start failed: ${startError?.message ?? String(startError)}`,
          source: 'Engine',
        });
      }
    },
    {
      visibleInSearch: true,
      description: ['Engine: Configured Start in Debugger...', 'Engine Deploy & Configured Start'],
      enabledWhen: () => isDeployEnabled(bifrost, connectionManager),
    },
  );

  // ─── Start without deploy (for already-deployed processes) ────────

  bifrost.commands.register(
    'engine.menubar.startCurrentProcessInDebugger',
    async () => {
      const activeEngineId = connectionManager.getActiveEngineId();
      if (!activeEngineId) {
        bifrost.notifications.open({ type: 'warning', content: 'No engine connected.', source: 'Engine' });
        return;
      }

      const processModelId = resolveCurrentProcessModelId(bifrost);
      if (!processModelId) {
        bifrost.notifications.open({
          type: 'warning',
          content: 'No BPMN process currently focused.',
          source: 'Engine',
        });
        return;
      }

      await bifrost.commands.executeCommand(ENGINE_COMMANDS.startProcessAndOpenDebugger, [
        activeEngineId,
        processModelId,
      ]);
    },
    {
      visibleInSearch: true,
      description: ['Engine: Start Current Process (no deploy)', 'Engine Start Process'],
      enabledWhen: () => isStartEnabled(bifrost, connectionManager),
    },
  );

  bifrost.commands.register(
    'engine.menubar.configuredStartCurrentProcessInDebugger',
    async () => {
      const activeEngineId = connectionManager.getActiveEngineId();
      if (!activeEngineId) {
        bifrost.notifications.open({ type: 'warning', content: 'No engine connected.', source: 'Engine' });
        return;
      }

      const processModelId = resolveCurrentProcessModelId(bifrost);
      if (!processModelId) {
        bifrost.notifications.open({
          type: 'warning',
          content: 'No BPMN process currently focused.',
          source: 'Engine',
        });
        return;
      }

      await bifrost.commands.executeCommand(ENGINE_COMMANDS.configuredStartProcessAndOpenDebugger, [
        activeEngineId,
        processModelId,
      ]);
    },
    {
      visibleInSearch: true,
      description: ['Engine: Configured Start Current Process (no deploy)...', 'Engine Configured Start'],
      enabledWhen: () => isStartEnabled(bifrost, connectionManager),
    },
  );

  // ─── Engine selector command ──────────────────────────────────────

  bifrost.commands.register('engine.menubar.setActiveEngine', (engineId: string) => {
    connectionManager.setActiveEngine(engineId);
    bifrost.menuBar.updateMenuBarItems();
  });

  // ─── Shift-aware play button ──────────────────────────────────────

  bifrost.commands.register(
    'engine.menubar.playButton',
    async (context: CommandContext) => {
      const useConfiguredStart = context?.type === 'mouse' && context.mouseEvent?.shiftKey;

      if (isFocusedDocumentModelViewer(bifrost)) {
        const activeEngineId = connectionManager.getActiveEngineId();
        if (!activeEngineId) {
          return;
        }
        const processModelId = resolveCurrentProcessModelId(bifrost);
        if (!processModelId) {
          return;
        }
        if (useConfiguredStart) {
          await bifrost.commands.executeCommand(ENGINE_COMMANDS.configuredStartProcessAndOpenDebugger, [
            activeEngineId,
            processModelId,
          ]);
        } else {
          await bifrost.commands.executeCommand(ENGINE_COMMANDS.startProcessAndOpenDebugger, [
            activeEngineId,
            processModelId,
          ]);
        }
        return;
      }

      if (useConfiguredStart) {
        await bifrost.commands.executeCommand('engine.quickDeployAndConfiguredDebug', []);
      } else {
        await bifrost.commands.executeCommand('engine.quickDeployAndDebug', []);
      }
    },
    {
      expectsContext: true,
      enabledWhen: () => isStartEnabled(bifrost, connectionManager) || isDeployEnabled(bifrost, connectionManager),
    },
  );

  // ─── Shift-aware deploy button ────────────────────────────────────

  bifrost.commands.register(
    'engine.menubar.deployButton',
    async (context: CommandContext) => {
      const openAfterDeploy = context?.type === 'mouse' && context.mouseEvent?.shiftKey;
      if (openAfterDeploy) {
        await bifrost.commands.executeCommand('engine.deployAndOpenCurrentProcess', []);
      } else {
        await bifrost.commands.executeCommand('engine.deployCurrentProcess', []);
      }
    },
    { expectsContext: true, enabledWhen: () => isDeployEnabled(bifrost, connectionManager) },
  );

  // ─── Run menu ─────────────────────────────────────────────────────

  bifrost.menus.registerMenuModifier('std/application/main', async (menuPromise) => {
    const menu: Menu = await menuPromise;

    const goIndex = menu.findIndex((item) => item.id === 'go');
    const insertIndex = goIndex >= 0 ? goIndex + 1 : menu.length;

    const runSubmenu: MenuItem[] = [
      {
        type: 'command',
        id: 'run/deploy-current',
        label: 'Deploy Current Process',
        command: 'engine.deployCurrentProcess',
        formattedKeystroke: 'F3',
      },
      {
        type: 'command',
        id: 'run/deploy-and-open',
        label: 'Deploy && Open Current Process',
        command: 'engine.deployAndOpenCurrentProcess',
        formattedKeystroke: 'Shift+F3',
      },
      {
        type: 'command',
        id: 'run/deploy-solution',
        label: 'Deploy Solution...',
        command: 'engine.deploySolution',
      },
      { type: 'divider' },
      {
        type: 'command',
        id: 'run/quick-debug',
        label: 'Start in Debugger',
        command: 'engine.quickDeployAndDebug',
        formattedKeystroke: 'F5',
      },
      {
        type: 'command',
        id: 'run/configured-debug',
        label: 'Configured Start in Debugger...',
        command: 'engine.quickDeployAndConfiguredDebug',
        formattedKeystroke: 'Shift+F5',
      },
      { type: 'divider' },
      {
        type: 'command',
        id: 'run/start-current',
        label: 'Start Current Process in Debugger',
        command: 'engine.menubar.startCurrentProcessInDebugger',
      },
      {
        type: 'command',
        id: 'run/configured-start-current',
        label: 'Configured Start Current Process...',
        command: 'engine.menubar.configuredStartCurrentProcessInDebugger',
      },
      { type: 'divider' },
      {
        type: 'command',
        id: 'run/bump-version',
        label: 'Bump Version',
        command: 'bpmn.process.bumpVersion',
      },
    ];

    const runMenu: MenuItem = {
      type: 'menu',
      id: 'run',
      label: 'Run',
      submenu: runSubmenu,
    };

    menu.splice(insertIndex, 0, runMenu);
    return menu;
  });

  // ─── Menubar items ────────────────────────────────────────────────

  bifrost.menuBar.registerMenuBarItemModifier((menuBarItems: MenuBarItemMap) => {
    const activeEngineId = connectionManager.getActiveEngineId();
    const connection = activeEngineId ? connectionManager.getConnection(activeEngineId) : null;
    const allEngines = connectionManager.getAllEngines();
    const focusedDoc = bifrost.editors.getFocusedEditorDocument();
    const isViewingModelViewer = focusedDoc?.documentType === 'engine-model-viewer';

    const playTooltip = isViewingModelViewer
      ? 'Start Current Process in Debugger\n[Shift+Click] Configured Start'
      : 'Quick Deploy & Start in Debugger (F5)\n[Shift+Click] Configured Start';

    const centerItems = menuBarItems.center ?? [];
    centerItems.push(
      {
        type: 'button',
        id: 'engine-menubar/open-engine',
        icon: 'ph-duotone ph-gauge',
        tooltip: 'Open Engine Dashboard',
        command: 'engine.workspace.openDashboard',
        commandArgs: activeEngineId ? [activeEngineId] : [],
        visible: activeEngineId != null && connectionManager.isConnected(activeEngineId),
      },
      {
        type: 'button',
        id: 'engine-menubar/play',
        icon: 'ph-fill ph-play',
        tooltip: playTooltip,
        command: 'engine.menubar.playButton',
      },
      {
        type: 'button',
        id: 'engine-menubar/deploy',
        icon: 'ph ph-paper-plane-tilt',
        tooltip: 'Deploy Current Process (F3)\n[Shift+Click] Deploy & Open',
        visible: isDeployEnabled(bifrost, connectionManager),
        command: 'engine.menubar.deployButton',
      },
    );

    if (allEngines.length > 0) {
      centerItems.push({
        type: 'select',
        id: 'engine-menubar/engine-select',
        command: 'engine.menubar.setActiveEngine',
        value: activeEngineId ?? '',
        entries: allEngines.map((engine) => ({
          label: formatEngineLabel(engine),
          value: engine.engineId,
        })),
        tooltip: connection?.url ?? 'Select an engine',
      });
    } else {
      centerItems.push({
        type: 'text',
        id: 'engine-menubar/engine-name',
        label: 'No engine',
        tooltip: 'Connect an engine to get started',
      });
    }

    return { ...menuBarItems, center: centerItems };
  });

  // ─── Engine event subscriptions for menubar refresh ───────────────

  const refreshMenuBar = () => bifrost.menuBar.updateMenuBarItems();
  connectionManager.on('engine:list-changed', refreshMenuBar);
  connectionManager.on('engine:state-changed', refreshMenuBar);
  connectionManager.on('engine:disconnected', refreshMenuBar);
  connectionManager.on('engine:connected', refreshMenuBar);
  connectionManager.on('engine:reconnected', refreshMenuBar);

  // ─── Keybindings ──────────────────────────────────────────────────

  bifrost.keybindings.registerKeyBindings({
    client: '*',
    os: '*',
    bindings: {
      body: {
        f3: 'engine.deployCurrentProcess',
        'shift+f3': 'engine.deployAndOpenCurrentProcess',
        f5: 'engine.quickDeployAndDebug',
        'shift+f5': 'engine.quickDeployAndConfiguredDebug',
      },
    },
  });
}

function resolveCurrentProcessModelId(bifrost: Bifrost): string | null {
  const doc = bifrost.editors.getFocusedEditorDocument();
  if (!doc?.uri) {
    return null;
  }

  if (doc.documentType === 'engine-model-viewer') {
    return extractProcessModelIdFromModelViewerUri(doc.uri);
  }

  if (doc.uri.toLowerCase().endsWith('.bpmn')) {
    const filePath = doc.uri.startsWith('file://') ? doc.uri.slice(7) : doc.uri;
    const fileName = path.basename(filePath, '.bpmn');
    return fileName;
  }

  return null;
}

async function collectDeployableFiles(
  dirPath: string,
  results: { content: string; name: string; filePath?: string }[],
): Promise<void> {
  try {
    const entries = await fs.readdir(dirPath, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry.name);
      if (entry.isDirectory() && !entry.name.startsWith('.') && entry.name !== 'node_modules') {
        await collectDeployableFiles(fullPath, results);
      } else if (entry.isFile()) {
        const lower = entry.name.toLowerCase();
        if (DEPLOYABLE_EXTENSIONS.some((ext) => lower.endsWith(ext))) {
          const content = await fs.readFile(fullPath, 'utf-8');
          results.push({ content, name: entry.name, filePath: fullPath });
        }
      }
    }
  } catch {
    // skip inaccessible directories
  }
}

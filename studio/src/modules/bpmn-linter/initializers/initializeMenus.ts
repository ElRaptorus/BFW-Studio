import type { Bifrost } from '#bifrost/Bifrost';

import type { Menu } from '@evil/bifrost_fw_sdk';

function isBpmnUri(uri: string | undefined): boolean {
  return typeof uri === 'string' && uri.toLowerCase().endsWith('.bpmn');
}

function lintableMultiSelectionUris(selectedMetadata: any[]): string[] {
  return (selectedMetadata ?? [])
    .filter((meta: any) => {
      if (meta?.uri == null) {
        return false;
      }
      if (meta.type === 'directory') {
        return true;
      }
      return meta.type === 'file' && isBpmnUri(meta.uri);
    })
    .map((meta: any) => meta.uri as string);
}

export function initializeMenus(bifrost: Bifrost): void {
  bifrost.menus.registerMenuModifier(
    'std/application/main',
    async (mainMenu: Promise<Menu> | Menu, studio: Bifrost): Promise<Menu> => {
      const menu = await mainMenu;
      const liveLintEnabled = studio.settings.get('bpmnLinter.enabled') === true;
      return studio.menus.insertBeforeMenuItem(menu, 'view/bpmn-editor/show-grid', [
        {
          type: 'command',
          id: 'view/bpmn-editor/live-linter',
          label: 'Live Linter',
          checked: liveLintEnabled,
          command: 'bpmn.linter.toggle',
        },
        { type: 'divider' },
      ]);
    },
  );

  bifrost.menus.registerMenuModifier('std/file-explorer/file', (menu: Menu, metadata: any) => {
    if (!isBpmnUri(metadata?.uri)) {
      return menu;
    }

    return bifrost.menus.insertBeforeMenuItem(menu, 'std/file-explorer/file/compare-to/external-file', [
      {
        type: 'command',
        label: 'Lint File',
        id: 'bpmn-linter/file/lint',
        icon: 'ph ph-fill ph-highlighter',
        command: 'bpmn.linter.lintUris',
        commandArgs: [[metadata.uri]],
      },
    ]);
  });

  bifrost.menus.registerMenuModifier('std/file-explorer/directory', (menu: Menu, metadata: any) => {
    if (!metadata?.uri) {
      return menu;
    }

    return bifrost.menus.insertBeforeMenuItem(menu, 'std/file-explorer/directory/rename', [
      {
        type: 'command',
        label: 'Lint Folder',
        id: 'bpmn-linter/directory/lint',
        icon: 'ph ph-fill ph-highlighter',
        command: 'bpmn.linter.lintUris',
        commandArgs: [[metadata.uri]],
      },
    ]);
  });

  bifrost.menus.registerMenuModifier('std/file-explorer/project', (menu: Menu, metadata: any) => {
    if (!metadata?.uri) {
      return menu;
    }

    return bifrost.menus.insertBeforeMenuItem(menu, 'std/file-explorer/project/rename-project', [
      {
        type: 'command',
        label: 'Lint Folder',
        id: 'bpmn-linter/project/lint',
        icon: 'ph ph-fill ph-highlighter',
        command: 'bpmn.linter.lintUris',
        commandArgs: [[metadata.uri]],
      },
    ]);
  });

  bifrost.menus.registerMenuModifier('std/file-explorer/solution-root', (menu: Menu, metadata: any) => {
    if (!metadata?.uri) {
      return menu;
    }

    return bifrost.menus.insertBeforeMenuItem(menu, 'std/file-explorer/solution-root/rename', [
      {
        type: 'command',
        label: 'Lint Folder',
        id: 'bpmn-linter/solution-root/lint',
        icon: 'ph ph-fill ph-highlighter',
        command: 'bpmn.linter.lintUris',
        commandArgs: [[metadata.uri]],
      },
    ]);
  });

  bifrost.menus.registerMenuModifier('std/file-explorer/solution', (menu: Menu) => {
    return bifrost.menus.insertBeforeMenuItem(menu, 'std/file-explorer/solution/reveal-solution-in-file-manager', [
      {
        type: 'command',
        label: 'Lint Solution',
        id: 'bpmn-linter/solution/lint',
        icon: 'ph ph-fill ph-highlighter',
        command: 'bpmn.linter.lintSolution',
      },
      { type: 'divider' },
    ]);
  });

  bifrost.menus.registerMenuModifier('std/file-explorer/multi-selection', (menu: Menu, selectedMetadata: any[]) => {
    const lintableUris = lintableMultiSelectionUris(selectedMetadata);
    if (lintableUris.length === 0) {
      return menu;
    }

    return bifrost.menus.insertBeforeMenuItem(menu, 'std/file-explorer/multi-selection/delete', [
      {
        type: 'command',
        label: `Lint ${lintableUris.length} items`,
        id: 'bpmn-linter/multi-selection/lint',
        icon: 'ph ph-fill ph-highlighter',
        command: 'bpmn.linter.lintUris',
        commandArgs: [lintableUris],
      },
    ]);
  });
}

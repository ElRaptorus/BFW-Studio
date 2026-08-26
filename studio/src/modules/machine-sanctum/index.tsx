import type { Bifrost } from '#bifrost/Bifrost';
import { assertGenericCommandContext } from '#bifrost/common/AssertionFunctions';
import type { CommandContext } from '#bifrost/contracts/CommandTypes';
import type { QuickJumpItem } from '#bifrost/contracts/QuickJumpTypes';

import React from 'react';

import MachineSanctumDocumentModel from './MachineSanctumDocumentModel';
import MachineSanctumRenderer from './MachineSanctumRenderer';
import { NOTIFICATION_EXAMPLES } from './pages/NotificationExamples';

export function onLoad(bifrost: Bifrost): void {
  bifrost.editors.registerDocumentType('machine-sanctum', {
    uriMatch: /^about:machine-sanctum(|\/.+)$/,
    modelKey: 'MachineSanctumDocumentModel',
    modelConstructor: MachineSanctumDocumentModel,
    rendererKey: 'MachineSanctumRenderer',
    rendererConstructor: MachineSanctumRenderer,
    icon: 'machine-sanctum/document-type/default',
  });

  bifrost.icons.registerIcons({
    'machine-sanctum/document-type/default': 'ph-duotone ph-test-tube machine-sanctum__document--tab-icon',
    'machine-sanctum/hero': 'ph-light ph-test-tube machine-sanctum__document--tab-icon',
    'machine-sanctum/tree/stack-example': (
      <svg viewBox="0 0 256 256" style={{ width: '1em', height: '1em' }}>
        <path
          fill="currentColor"
          d="M208,56H180.28L166.65,35.56A8,8,0,0,0,160,32H96a8,8,0,0,0-6.65,3.56L75.72,56H48A24,24,0,0,0,24,80V192a24,24,0,0,0,24,24H208a24,24,0,0,0,24-24V80A24,24,0,0,0,208,56Zm8,136a8,8,0,0,1-8,8H48a8,8,0,0,1-8-8V80a8,8,0,0,1,8-8H80a8,8,0,0,0,6.66-3.56L100.28,48h55.44l13.62,20.44A8,8,0,0,0,176,72h32a8,8,0,0,1,8,8ZM128,88a44,44,0,1,0,44,44A44.05,44.05,0,0,0,128,88Zm0,72a28,28,0,1,1,28-28A28,28,0,0,1,128,160Z"
        />
        <path
          fill="Tomato"
          d="M128,24A104,104,0,1,0,232,128,104.11,104.11,0,0,0,128,24Zm88,104a87.56,87.56,0,0,1-20.41,56.28L71.72,60.41A88,88,0,0,1,216,128ZM40,128A87.56,87.56,0,0,1,60.41,71.72L184.28,195.59A88,88,0,0,1,40,128Z"
        />
      </svg>
    ),
  });

  bifrost.commands.register('dev.machineSanctum.showCommands', () =>
    bifrost.quickJump.showCommandsMatching(
      /^(dev\.machineSanctum\..+|std.workbench.enableContributorMode|std.workbench.disableContributorMode)$/,
      '',
    ),
  );

  bifrost.commands.register(
    'dev.machineSanctum.open',
    () => bifrost.editors.focusOrOpenEditorDocument('about:machine-sanctum', 'Machine Sanctum'),
    { visibleInSearch: true, description: 'View: Machine Sanctum' },
  );

  bifrost.commands.register('dev.machineSanctum.benchmark.openNotifications', () => {
    const defaultCounts = [10, 100, 1000];
    const entries = defaultCounts.map((count: number): QuickJumpItem => {
      return {
        type: 'command',
        command: 'dev.machineSanctum.benchmark.openNotifications.step2',
        commandArgs: [count],
        label: `${count}`,
      };
    });
    const useCustomCount: QuickJumpItem = {
      type: 'command',
      command: 'dev.machineSanctum.benchmark.openNotifications.step2',
      label: 'Use the entered amount ...',
      sticky: true,
    };

    bifrost.quickJump.show({
      prompt: 'How many notifications should be generated?',
      entries: [...entries, useCustomCount],
    });
  });

  bifrost.commands.register(
    'dev.machineSanctum.quickJump.showCommandsWithNamesAsLabels',
    () => bifrost.views.getById('std/quick-jump').showCommandsWithNamesAsLabels(),
    { visibleInSearch: true, description: 'Machine Sanctum: Run command by name' },
  );

  bifrost.commands.register('dev.machineSanctum.test.throwError', () => {
    throw new Error('error in Bifrost command');
  });

  bifrost.commands.register('dev.machineSanctum.test.throwErrorInSettimeout', () => {
    setTimeout(() => {
      throw new Error('error in a setTimeout() in a Bifrost command');
    }, 500);
  });

  bifrost.commands.register(
    'dev.machineSanctum.benchmark.openNotifications.step2',
    (ctx: CommandContext, givenCount?: number) => {
      assertGenericCommandContext(ctx);

      const addedNotificationsMax = givenCount || ctx.data.inputValue;
      const startTime = Date.now();
      let addedNotifications = 0;

      const launchRandomNotification = () => {
        const example = NOTIFICATION_EXAMPLES[Math.floor(Math.random() * NOTIFICATION_EXAMPLES.length)];

        bifrost.notifications.open(example.data, (response: any) => console.log('Notification response was', response));
      };

      const performAddNotification = () => {
        addedNotifications++;
        launchRandomNotification();

        if (addedNotifications < addedNotificationsMax) {
          setTimeout(performAddNotification, 1);
        } else {
          const duration = Date.now() - startTime;

          bifrost.notifications.open(
            `Took ${duration} ms to generate ${addedNotifications} notifications (${Math.floor(
              1000 / (duration / addedNotifications),
            )} per second).`,
          );
        }
      };
      setTimeout(performAddNotification, 1);
    },
    { expectsContext: true },
  );

  bifrost.menus.registerMenu('machine-sanctum/notifications/editor-title', () => {
    return [
      {
        type: 'command',
        label: 'Introduction',
        id: 'machine-sanctum/notifications/editor-title/introduction',
        icon: 'ph-duotone ph-rocket-launch',
        command: 'std.internal.empty',
      },
      {
        type: 'command',
        label: 'Examples',
        id: 'machine-sanctum/notifications/editor-title/examples',
        icon: 'ph-duotone ph-globe-stand',
        command: 'std.internal.empty',
      },
      {
        type: 'divider',
      },
      {
        type: 'command',
        label: 'Advanced usage',
        id: 'machine-sanctum/notifications/editor-title/advanced-usage',
        command: 'std.internal.empty',
      },
    ];
  });

  bifrost.menus.registerMenu('machine-sanctum/editor-toolbar/more-pages', () => {
    return [
      {
        type: 'command',
        label: 'Contextmenu',
        id: 'machine-sanctum/editor-toolbar/more-pages/contextmenu',
        command: 'std.editor.focusOrOpenDocument',
        commandArgs: ['about:machine-sanctum/contextmenu'],
      },
      {
        type: 'command',
        label: 'Errors',
        id: 'machine-sanctum/editor-toolbar/more-pages/errors',
        command: 'std.editor.focusOrOpenDocument',
        commandArgs: ['about:machine-sanctum/errors'],
      },
      {
        type: 'command',
        label: 'Property Panel',
        id: 'machine-sanctum/editor-toolbar/more-pages/property-panel',
        command: 'std.editor.focusOrOpenDocument',
        commandArgs: ['about:machine-sanctum/property_panel'],
      },
      {
        type: 'command',
        label: 'Editor Responsiveness',
        id: 'machine-sanctum/editor-toolbar/more-pages/editor-responsiveness',
        command: 'std.editor.focusOrOpenDocument',
        commandArgs: ['about:machine-sanctum/responsiveness'],
      },
    ];
  });

  bifrost.menus.registerMenu('machine-sanctum/error_example', (shouldCrashDuringMenuBuilding: boolean = true) => {
    if (shouldCrashDuringMenuBuilding) {
      throw new Error('This is an expected example error thrown during a menu factory function.');
    }

    return [];
  });

  bifrost.statusBar.registerStatusBarItem(
    'left',
    'std/machine-sanctum',
    () => {
      return [
        {
          type: 'button',
          id: 'editor/machine-sanctum',
          tooltip: 'Machine Sanctum',
          content: { type: 'icon', icon: 'std/status-bar/machine-sanctum' },
          command: 'dev.machineSanctum.open',
        },
      ];
    },
    200,
  );
}

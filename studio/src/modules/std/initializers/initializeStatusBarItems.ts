import type { Bifrost } from '#bifrost/Bifrost';
import { EVENT_DIAGNOSTICS_CHANGED } from '#bifrost/common/DiagnosticsManager';

import { EVENT_EDITOR_AREA_FOCUS_UPDATED } from '../../../../../studio-sdk/src/contracts/internal/EditorEvents';
import { EVENT_THEME_CHANGED } from '../../../../../studio-sdk/src/contracts/internal/ThemeEvents';

const FILE_BACKED_DOCUMENT_TYPES = new Set(['bpmn']);

export function initializeStatusBarItems(bifrost: Bifrost): void {
  registerStatusBarItems(bifrost);
}

function registerStatusBarItems(bifrost: Bifrost): void {
  bifrost.theme.on(EVENT_THEME_CHANGED, () => {
    bifrost.statusBar.updateStatusBarItems();
  });

  bifrost.diagnostics.on(EVENT_DIAGNOSTICS_CHANGED, () => {
    bifrost.statusBar.updateStatusBarItems();
  });

  bifrost.editors.on(EVENT_EDITOR_AREA_FOCUS_UPDATED, () => {
    bifrost.statusBar.updateStatusBarItems();
  });

  bifrost.statusBar.registerStatusBarItem(
    'left',
    'std/solution-name',
    () => {
      const solution = bifrost.solution.getSolution();
      if (solution) {
        return [
          {
            type: 'button',
            id: 'solution-name',
            tooltip: `Current solution:${solution.name} - Click to open a new one.`,
            content: { type: 'text', label: solution.name },
            command: 'std.editor.openFolderAsSolution',
            active: true,
          },
        ];
      }

      return [
        {
          type: 'button',
          id: 'solution-name',
          tooltip: 'No solution opened',
          content: { type: 'text', label: 'No Solution' },
          command: 'std.editor.openFolderAsSolution',
        },
      ];
    },
    60,
  );

  bifrost.statusBar.registerStatusBarItem(
    'left',
    'std/problems',
    () => {
      const doc = bifrost.editors.getFocusedEditorDocument();
      const uri = doc?.uri;

      let errors = 0;
      let warnings = 0;

      if (uri) {
        const diagnosticsMap = bifrost.diagnostics.getDiagnostics(uri);
        const diagnostics = diagnosticsMap.get(uri);
        if (diagnostics) {
          for (const diagnostic of diagnostics) {
            if (diagnostic.severity === 'error') {
              errors++;
            } else if (diagnostic.severity === 'warning') {
              warnings++;
            }
          }
        }
      }

      return [
        {
          type: 'button',
          id: 'problems',
          tooltip: `${errors} Errors, ${warnings} Warnings`,
          content: [
            { type: 'icon', icon: 'std/status-bar/problems-error' },
            { type: 'text', label: `${errors}` },
            { type: 'icon', icon: 'std/status-bar/problems-warning' },
            { type: 'text', label: `${warnings}` },
          ],
          command: 'std.noop',
        },
      ];
    },
    50,
  );

  bifrost.statusBar.registerStatusBarItem(
    'right',
    'std/notifications',
    () => {
      const viewdata = bifrost.notifications.getViewData();
      const notifications = viewdata.notifications;
      const notificationCount: string = notifications.length === 0 ? '' : `${notifications.length}`;

      return [
        {
          type: 'button',
          id: 'notifications',
          tooltip: 'Notifications',
          content: [
            { type: 'icon', icon: 'std/status-bar/notifications' },
            { type: 'text', label: notificationCount },
          ],
          command: 'std.workbench.toggleNotifications',
        },
      ];
    },
    10,
  );

  bifrost.statusBar.registerStatusBarItem(
    'right',
    'std/status/inspectdocument',
    () => {
      return [
        {
          type: 'button',
          id: 'status/inspectdocument',
          tooltip: 'Inspect focussed editor document',
          content: [{ type: 'icon', icon: 'std/status-bar/inspectdocument' }],
          command: 'std.workbench.focusEditorDocumentInspector',
        },
      ];
    },
    20,
  );

  bifrost.statusBar.registerStatusBarItem(
    'right',
    'std/theme-switcher',
    () => {
      const isDark = bifrost.theme.isCurrentThemeDark();
      const themeId = bifrost.theme.getCurrentTheme();
      const themeDef = bifrost.theme.getTheme(themeId);
      const themeLabel = themeDef?.label ?? themeId;
      return [
        {
          type: 'button',
          id: 'theme-switcher',
          tooltip: `Theme: ${themeLabel}`,
          content: { type: 'icon', icon: isDark ? 'std/status-bar/theme-dark' : 'std/status-bar/theme-light' },
          command: 'std.workbench.chooseTheme',
        },
      ];
    },
    40,
  );

  bifrost.statusBar.registerStatusBarItem(
    'right',
    'std/encoding',
    () => {
      const doc = bifrost.editors.getFocusedEditorDocument();
      if (!doc || !FILE_BACKED_DOCUMENT_TYPES.has(doc.documentType)) {
        return [];
      }
      return [
        {
          type: 'button',
          id: 'encoding',
          tooltip: 'File Encoding',
          content: { type: 'text', label: 'UTF-8' },
          command: 'std.noop',
        },
      ];
    },
    50,
  );

  bifrost.statusBar.registerStatusBarItem(
    'right',
    'std/line-ending',
    () => {
      const doc = bifrost.editors.getFocusedEditorDocument();
      if (!doc || !FILE_BACKED_DOCUMENT_TYPES.has(doc.documentType)) {
        return [];
      }
      const content = typeof doc.data?.current === 'string' ? doc.data.current : '';
      const lineEnding = content.includes('\r\n') ? 'CRLF' : 'LF';
      return [
        {
          type: 'button',
          id: 'line-ending',
          tooltip: 'Line Ending',
          content: { type: 'text', label: lineEnding },
          command: 'std.noop',
        },
      ];
    },
    60,
  );
}

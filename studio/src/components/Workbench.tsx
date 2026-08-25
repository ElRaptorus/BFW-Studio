import { EVENT_MENU_BAR_UPDATED } from '#bifrost/common/MenuBarManager';
import { EVENT_CLOSE_NOTIFICATION, EVENT_OPEN_NOTIFICATION } from '#bifrost/common/NotificationManager';
import { EVENT_QUICK_JUMP_ENTRIES_CHANGED } from '#bifrost/common/QuickJumpView';
import { EVENT_STATUS_BAR_UPDATED } from '#bifrost/common/StatusBarManager';
import { EVENT_FILE_EXPLORER_OPENED_SOLUTION } from '#bifrost/common/activities';
import { EVENT_RECENTLY_OPENED_CHANGED } from '#bifrost/contracts/RecentTypes';

import React, { useCallback, useDeferredValue, useEffect, useReducer, useRef, useState } from 'react';

import type { AbstractSubscription, Dialog, DialogValidationResult } from '@evil/bifrost_fw_sdk';
import { Icon, assertNotNull } from '@evil/bifrost_fw_sdk';

import {
  EVENT_CLOSE_DIALOG,
  EVENT_OPEN_DIALOG,
  EVENT_VALIDATED_DIALOG,
} from '../../../studio-sdk/src/contracts/internal/DialogEvents';
import {
  EVENT_EDITOR_AREA_FOCUS_UPDATED,
  EVENT_EDITOR_AREA_LAYOUT_UPDATED,
  EVENT_EDITOR_DOCUMENT_DATA_UPDATED,
  EVENT_EDITOR_DOCUMENT_METADATA_UPDATED,
  EVENT_EDITOR_DOCUMENT_URI_UPDATED,
} from '../../../studio-sdk/src/contracts/internal/EditorEvents';
import { EVENT_PANE_LAYOUT_UPDATED } from '../../../studio-sdk/src/contracts/internal/PaneEvents';
import { EVENT_SETTINGS_CHANGED } from '../../../studio-sdk/src/contracts/internal/SettingsEvents';
import { useBifrost } from '../bifrostContext';
import { ErrorBoundaryWithMessage } from './ErrorBoundaryWithMessage';
import DialogContainer from './dialog/Dialog';
import EditorArea from './editors/EditorArea';
import MenuBarSection from './menu_bar/MenuBarSection';
import NotificationContainer from './notifications/NotificationContainer';
import PaneAreaBottom from './panes/PaneAreaBottom';
import PaneAreaLeft from './panes/PaneAreaLeft';
import PaneAreaRight from './panes/PaneAreaRight';
import QuickJump from './quick_jump/QuickJump';
import { SplitterLayout } from './splitter/SplitterLayout';
import { SplitterLayoutMediator } from './splitter/SplitterLayoutMediator';
import StatusBar from './status_bar/StatusBar';

/**
 * The Workbench is where the magic happens.
 * It represents the total of the UI, in which the users performs his or her actions.
 */
export default function Workbench(): React.JSX.Element {
  const bifrost = useBifrost();

  const [_, forceUpdate] = useReducer((x) => x + 1, 0);

  const [splitterLayoutMediator] = useState(() => new SplitterLayoutMediator());

  const ref = useRef<HTMLDivElement>(null);

  const [dialog, setDialog] = useState<Dialog | null>(null);
  const [editorArea, setEditorArea] = useState({ ...bifrost.editors.getViewData() });
  const [menuBar, setMenuBar] = useState({ ...bifrost.menuBar.getViewData() });
  const [notifications, setNotifications] = useState({ ...bifrost.notifications.getViewData() });
  const [paneArea, setPaneArea] = useState({ ...bifrost.panes.getViewData() });
  const [quickJump, setQuickJump] = useState({ ...bifrost.quickJump.getViewData() });
  const [statusBar, setStatusBar] = useState({ ...bifrost.statusBar.getViewData() });

  const deferredEditorArea = useDeferredValue(editorArea);
  const deferredPaneArea = useDeferredValue(paneArea);

  useEffect(() => {
    const timeoutIds: ReturnType<typeof setTimeout>[] = [];
    const subscriptions: AbstractSubscription[] = [
      bifrost.dialog.on(EVENT_CLOSE_DIALOG, () => setDialog(null)),
      bifrost.dialog.on(EVENT_OPEN_DIALOG, (dialog: Dialog) => setDialog(dialog)),
      bifrost.dialog.on(EVENT_VALIDATED_DIALOG, (validationResult: DialogValidationResult) =>
        setDialog((dialog) => {
          assertNotNull(dialog, 'dialog');
          return { ...dialog, validationResult };
        }),
      ),

      bifrost.editors.on(EVENT_EDITOR_AREA_LAYOUT_UPDATED, () => setEditorArea(bifrost.editors.getViewData())),
      bifrost.editors.on(EVENT_EDITOR_AREA_FOCUS_UPDATED, () => {
        forceUpdate();
        ensureFocusOnEditor(ref);
      }),

      bifrost.notifications.on(EVENT_OPEN_NOTIFICATION, () =>
        setNotifications({ ...bifrost.notifications.getViewData() }),
      ),
      bifrost.notifications.on(EVENT_CLOSE_NOTIFICATION, () =>
        setNotifications({ ...bifrost.notifications.getViewData() }),
      ),

      bifrost.menuBar.on(EVENT_MENU_BAR_UPDATED, () => setMenuBar({ ...bifrost.menuBar.getViewData() })),
      bifrost.panes.on(EVENT_PANE_LAYOUT_UPDATED, () => setPaneArea({ ...bifrost.panes.getViewData() })),
      bifrost.quickJump.on(EVENT_QUICK_JUMP_ENTRIES_CHANGED, () =>
        setQuickJump({ ...bifrost.quickJump.getViewData() }),
      ),
      bifrost.statusBar.on(EVENT_STATUS_BAR_UPDATED, () => setStatusBar({ ...bifrost.statusBar.getViewData() })),

      bifrost.editors.on(EVENT_EDITOR_DOCUMENT_DATA_UPDATED, () => forceUpdate()),
      bifrost.editors.on(EVENT_EDITOR_DOCUMENT_METADATA_UPDATED, () => forceUpdate()),
      bifrost.editors.on(EVENT_EDITOR_DOCUMENT_URI_UPDATED, () => forceUpdate()),
      bifrost.fileExplorerView.on(EVENT_FILE_EXPLORER_OPENED_SOLUTION, () => forceUpdate()),
      bifrost.recentlyOpened.on(EVENT_RECENTLY_OPENED_CHANGED, () => forceUpdate()),
      bifrost.settings.on(EVENT_SETTINGS_CHANGED, () => forceUpdate()),
      bifrost.events.on('unspecifiedGlobalUpdate', () => {
        const timeoutId = setTimeout(() => forceUpdate(), 100);
        timeoutIds.push(timeoutId);
      }),
    ];

    return () => {
      for (const subscription of subscriptions) {
        subscription.dispose();
      }
      for (const timeoutId of timeoutIds) {
        clearTimeout(timeoutId);
      }
    };
  }, [bifrost, forceUpdate]);

  const editorDocument = bifrost.editors.getFocusedEditorDocument();
  const editorDocumentModel = editorDocument ? bifrost.editors.getEditorDocumentModelIfPresent(editorDocument) : null;

  const onRightPaneSizeChange = useCallback(
    (pixels: number) => bifrost.panes.updatePaneAreaSize('right', pixels),
    [bifrost.panes],
  );
  const onLeftPaneSizeChange = useCallback(
    (pixels: number) => bifrost.panes.updatePaneAreaSize('left', pixels),
    [bifrost.panes],
  );
  const onBottomPaneSizeChange = useCallback(
    (pixels: number) => bifrost.panes.updatePaneAreaSize('bottom', pixels),
    [bifrost.panes],
  );

  const hasLeftMenuBarItems = menuBar.visible && menuBar.items.left.length > 0;
  const hasCenterMenuBarItems = menuBar.visible && menuBar.items.center.length > 0;
  const hasRightMenuBarItems = menuBar.visible && menuBar.items.right.length > 0;

  const appSplitterLayoutClassName = `app-layout__splitter-layout${statusBar.visible ? ' app-layout__splitter-layout--with-status-bar' : ''}`;

  const initMediator = useCallback(
    (instance: any) => splitterLayoutMediator.setSplitterLayoutInstance(instance),
    [splitterLayoutMediator],
  );

  return (
    <ErrorBoundaryWithMessage message="There has been a major error. Please restart the program.">
      <div className={`workbench`} ref={ref}>
        {dialog && (
          <DialogContainer
            iconComponent={Icon}
            options={dialog.options}
            responseCallback={dialog.responseCallbackFn}
            validationResult={dialog.validationResult}
          />
        )}

        {notifications.maximized && <NotificationContainer notifications={notifications.notifications} />}

        {quickJump.visible && (
          <QuickJump iconComponent={Icon} quickJump={bifrost.views.getById('std/quick-jump')} {...quickJump} />
        )}

        <div className="app-layout">
          <SplitterLayout
            customClassName={appSplitterLayoutClassName}
            secondaryInitialSize={deferredPaneArea.right.sizeInPixels}
            primaryMinSize={100}
            secondaryDefaultSize={300}
            secondaryMinSize={260}
            onSecondaryPaneSizeChange={onRightPaneSizeChange}
          >
            <SplitterLayout
              customClassName="app-layout__sidebar"
              primaryIndex={1}
              secondaryInitialSize={deferredPaneArea.left.sizeInPixels}
              secondaryDefaultSize={300}
              secondaryMinSize={260}
              primaryMinSize={100}
              onSecondaryPaneSizeChange={onLeftPaneSizeChange}
            >
              {deferredPaneArea.left.visible && (
                <div className="app-layout__column">
                  {hasLeftMenuBarItems && <MenuBarSection items={menuBar.items.left} align="center" />}
                  <ErrorBoundaryWithMessage message="This component has crashed. Please restart the program.">
                    <PaneAreaLeft
                      className="app-layout__panes-left"
                      paneGroups={deferredPaneArea.left.paneGroups}
                      editorDocument={editorDocument}
                      editorDocumentModel={editorDocumentModel}
                    />
                  </ErrorBoundaryWithMessage>
                </div>
              )}

              <div className="app-layout__column">
                {hasCenterMenuBarItems && <MenuBarSection items={menuBar.items.center} align="center" />}
                <div className="app-layout__center-content">
                  <SplitterLayout
                    customClassName="app-layout__main"
                    vertical
                    percentage
                    secondaryInitialSize={deferredPaneArea.bottom.sizeInPixels}
                    secondaryDefaultSize={30}
                    secondaryMinSize={10}
                    primaryMinSize={15}
                    onSecondaryPaneSizeChange={onBottomPaneSizeChange}
                    initMediator={initMediator}
                  >
                    <ErrorBoundaryWithMessage message="This component has crashed. Please restart the program.">
                      <EditorArea
                        layout={deferredEditorArea.layout}
                        focusedEditorId={deferredEditorArea.focusedEditorId}
                        focusedEditorDocumentUri={deferredEditorArea.focusedEditorDocumentUri}
                        editorTabsVisible={deferredEditorArea.editorTabsVisible}
                      />
                    </ErrorBoundaryWithMessage>

                    {deferredPaneArea.bottom.visible && (
                      <ErrorBoundaryWithMessage message="This component has crashed. Please restart the program.">
                        <PaneAreaBottom
                          className="app-layout__panes-bottom"
                          paneGroups={deferredPaneArea.bottom.paneGroups}
                          editorDocument={editorDocument}
                          editorDocumentModel={editorDocumentModel}
                          splitterLayoutMediator={splitterLayoutMediator}
                        />
                      </ErrorBoundaryWithMessage>
                    )}
                  </SplitterLayout>
                </div>
              </div>
            </SplitterLayout>

            {deferredPaneArea.right.visible && (
              <div className="app-layout__column">
                {hasRightMenuBarItems && <MenuBarSection items={menuBar.items.right} align="right" />}
                <ErrorBoundaryWithMessage message="This component has crashed. Please restart the program.">
                  <PaneAreaRight
                    className="app-layout__panes-right"
                    paneGroups={deferredPaneArea.right.paneGroups}
                    editorDocument={editorDocument}
                    editorDocumentModel={editorDocumentModel}
                  />
                </ErrorBoundaryWithMessage>
              </div>
            )}
          </SplitterLayout>
        </div>

        {statusBar.visible && (
          <StatusBar bifrost={bifrost} items={statusBar.items} progressLabel={statusBar.progressLabel} />
        )}
      </div>
    </ErrorBoundaryWithMessage>
  );
}

function ensureFocusOnEditor(ref: any): void {
  const rootElement = ref.current;
  if (rootElement == null) {
    return;
  }

  const editorThatShouldBeFocused: HTMLDivElement | null = rootElement.querySelector('[data-focused-editor]');

  if (editorThatShouldBeFocused == null) {
    return;
  }

  const editorArea: HTMLDivElement | null = rootElement.querySelector('[data-editor-area]');
  if (editorArea == null) {
    return;
  }

  const focusInEditorArea = editorArea.contains(document.activeElement) === true;
  const focusOnBody = document.activeElement?.nodeName === 'BODY';
  const focusIsInsideFocusedEditor = editorThatShouldBeFocused.contains(document.activeElement);
  const focusInEditorAreaButNotInFocusedEditor = focusInEditorArea && !focusIsInsideFocusedEditor;

  if (focusOnBody || focusInEditorAreaButNotInFocusedEditor) {
    editorThatShouldBeFocused.focus();
  }
}

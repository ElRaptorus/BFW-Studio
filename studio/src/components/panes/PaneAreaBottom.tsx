import { assertNotNull } from '#bifrost/common/AssertionFunctions';
import type { EditorDocumentModel } from '#bifrost/common/EditorDocumentModel';
import type { EditorDocument } from '#bifrost/contracts/EditorTypes';
import type { PaneGroupObject } from '#bifrost/contracts/PaneTypes';

import React, { useCallback, useState } from 'react';

import { useBifrost } from '../../bifrostContext';
import { ErrorBoundary } from '../ErrorBoundary';
import { Icon } from '../Icon';
import type { SplitterLayoutMediator } from '../splitter/SplitterLayoutMediator';
import PaneGroupTabBar, { getDisplayableGroups } from './PaneGroupTabBar';
import PaneTabContent from './PaneTabContent';
import PaneTabOptions from './PaneTabOptions';
import PanesTabList from './PanesTabList';

const PANE_AREA = 'bottom' as const;

type PaneAreaBottomProps = {
  className: string;
  paneGroups: PaneGroupObject[];
  editorDocument: EditorDocument | null;
  editorDocumentModel: EditorDocumentModel | null;
  splitterLayoutMediator: SplitterLayoutMediator;
};

export default function PaneAreaBottom(props: PaneAreaBottomProps): React.JSX.Element | null {
  const bifrost = useBifrost();
  const [dataFromPaneTabOptions, setDataFromPaneTabOptions] = useState({});

  const visibleGroups = getDisplayableGroups(
    props.paneGroups,
    props.editorDocument,
    props.editorDocumentModel,
    bifrost,
  );
  const showGroupTabBar = visibleGroups.length >= 2;

  const activeGroup = props.paneGroups.find((group) => group.visible) ?? props.paneGroups[0];
  const hasContent = activeGroup != null && activeGroup.panes.length > 0;
  const activeGroupIndex = hasContent ? props.paneGroups.indexOf(activeGroup) : 0;
  const activePane = hasContent ? activeGroup.panes[activeGroup.activePaneIndex ?? 0] : null;

  const activatePaneTab = useCallback(
    (index: number): void => {
      bifrost.panes.setActivePane(PANE_AREA, activeGroupIndex, index);
    },
    [bifrost.panes, activeGroupIndex],
  );

  const onSelectGroup = useCallback(
    (groupId: string) => {
      bifrost.panes.setActiveGroupInArea(PANE_AREA, groupId);
    },
    [bifrost.panes],
  );

  const activePaneId = activePane?.id;
  const updateDataFromPaneTabOptions = useCallback(
    (data: any): void => {
      if (activePaneId != null) {
        setDataFromPaneTabOptions((prev) => ({ ...prev, [activePaneId]: data }));
      }
    },
    [activePaneId],
  );

  const onClickMaximize = useCallback(() => {
    assertNotNull(props.splitterLayoutMediator, 'props.splitterLayoutMediator');

    const isMinimized = props.splitterLayoutMediator.secondaryPaneIsMinimizedToDefault();
    if (isMinimized) {
      props.splitterLayoutMediator.maximizeSecondaryPane();
    } else {
      props.splitterLayoutMediator.minimizeSecondaryPaneToDefault();
    }
  }, [props.splitterLayoutMediator]);

  if (!hasContent || activePane == null) {
    return null;
  }

  const cmd = bifrost.commands.getClickHandler();
  const isMinimized = props.splitterLayoutMediator.secondaryPaneIsMinimizedToDefault();
  const maximizeMinimizeIconId = isMinimized ? 'ph ph-caret-up' : 'ph ph-caret-down';

  return (
    <div className="main__bottom-pane">
      <div className="pane bottom-pane">
        {showGroupTabBar && (
          <div className="bottom-pane__group-tabs">
            <PaneGroupTabBar
              groups={props.paneGroups}
              activeGroupId={activeGroup.groupId}
              onSelectGroup={onSelectGroup}
              editorDocument={props.editorDocument}
              editorDocumentModel={props.editorDocumentModel}
              variant="text"
            />
          </div>
        )}
        <div className="bottom-pane__pane-tabs bottom-pane__pane-tabs--overflow">
          <div className="pane-tabs">
            <ErrorBoundary>
              <PanesTabList
                editorDocument={props.editorDocument!}
                editorDocumentModel={props.editorDocumentModel!}
                panes={activeGroup.panes}
                activePane={activePane}
                paneArea={PANE_AREA}
                paneAreaIndex={activeGroupIndex}
                key={`pane-area-${PANE_AREA}-${activeGroupIndex}`}
                movePane={bifrost.panes.movePane}
                activatePaneTab={activatePaneTab}
              />

              <span className="pane-tabs__options">
                <PaneTabOptions
                  editorDocument={props.editorDocument}
                  editorDocumentModel={props.editorDocumentModel}
                  pane={activePane}
                  dataFromPaneTabOptions={dataFromPaneTabOptions[activePane.id]}
                  onChangeDataFromPaneTabOptions={updateDataFromPaneTabOptions}
                />

                <span className="pane-tab-divider" />
                <span className="pane-tab-icon" onClick={onClickMaximize}>
                  <Icon id={maximizeMinimizeIconId} />
                </span>
                <span className="pane-tab-icon" onClick={cmd('std.workbench.toggleInspectorPanel')}>
                  <Icon id="ph ph-x" />
                </span>
              </span>
            </ErrorBoundary>
          </div>
        </div>
        <div className="bottom-pane__pane-content">
          <ErrorBoundary>
            <PaneTabContent
              editorDocument={props.editorDocument}
              editorDocumentModel={props.editorDocumentModel}
              pane={activePane}
              dataFromPaneTabOptions={dataFromPaneTabOptions[activePane.id]}
            />
          </ErrorBoundary>
        </div>
      </div>
    </div>
  );
}

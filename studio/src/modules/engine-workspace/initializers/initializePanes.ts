import type { Bifrost } from '#bifrost/Bifrost';

import * as DecisionSummaryPane from '../panes/DecisionSummaryPane';
import * as EngineSidebarPane from '../panes/EngineSidebarPane';
import * as ProcessInstanceSummaryPane from '../panes/ProcessInstanceSummaryPane';
import * as ProcessModelInfoPane from '../panes/ProcessModelInfoPane';
import * as ScheduleDetailPane from '../panes/ScheduleDetailPane';
import * as TaskDetailPane from '../panes/TaskDetailPane';

export default function initializePanes(bifrost: Bifrost): void {
  bifrost.panes.registerPaneGroup('left', 'engines', [
    bifrost.panes.getPaneViaPaneProvider(
      'pane/left/engines',
      'engine-workspace/pane-providers/EngineSidebarPane',
      EngineSidebarPane,
    ),
  ]);

  bifrost.panes.prependToPaneGroup('right', 'property', [
    bifrost.panes.getPaneViaPaneProvider(
      'pane/right/process-model-info',
      'engine-workspace/pane-providers/ProcessModelInfoPane',
      ProcessModelInfoPane,
    ),
    bifrost.panes.getPaneViaPaneProvider(
      'pane/right/process-instance-summary',
      'engine-workspace/pane-providers/ProcessInstanceSummaryPane',
      ProcessInstanceSummaryPane,
    ),
    bifrost.panes.getPaneViaPaneProvider(
      'pane/right/task-detail',
      'engine-workspace/pane-providers/TaskDetailPane',
      TaskDetailPane,
    ),
    bifrost.panes.getPaneViaPaneProvider(
      'pane/right/decision-summary',
      'engine-workspace/pane-providers/DecisionSummaryPane',
      DecisionSummaryPane,
    ),
    bifrost.panes.getPaneViaPaneProvider(
      'pane/right/schedule-detail',
      'engine-workspace/pane-providers/ScheduleDetailPane',
      ScheduleDetailPane,
    ),
  ]);

  bifrost.menuBar.registerMenuBarItemModifier((menuBarItems) => {
    return bifrost.menuBar.insertAfterMenuBarItem(menuBarItems, 'pane/left/git', () => [
      {
        type: 'pane_content_toggle',
        id: 'pane/left/engines',
        tooltip: 'Engines',
        icon: 'engine-workspace/sidebar-icon',
        paneAreaId: 'left',
        paneId: 'pane/left/engines',
      },
    ]);
  });
}

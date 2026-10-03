import type { Bifrost } from '#bifrost/Bifrost';

import * as DecisionSummaryPane from '../panes/DecisionSummaryPane';
import * as EngineSidebarPane from '../panes/EngineSidebarPane';
import * as ProcessInstanceSummaryPane from '../panes/ProcessInstanceSummaryPane';
import * as ProcessModelInfoPane from '../panes/ProcessModelInfoPane';
import * as ScheduleDetailPane from '../panes/ScheduleDetailPane';
import * as TaskDetailPane from '../panes/TaskDetailPane';

export default function initializePanes(bifrost: Bifrost): void {
  bifrost.panes.registerPaneGroup(
    'left',
    'engines',
    [
      bifrost.panes.getPaneViaPaneProvider(
        'debug/engines/engines',
        'engine-workspace/pane-providers/EngineSidebarPane',
        EngineSidebarPane,
      ),
    ],
    { pages: ['debug/engines'] },
  );

  bifrost.panes.prependToPaneGroup('right', 'property', [
    bifrost.panes.getPaneViaPaneProvider(
      'debug/engines/process-model-info',
      'engine-workspace/pane-providers/ProcessModelInfoPane',
      ProcessModelInfoPane,
    ),
    bifrost.panes.getPaneViaPaneProvider(
      'debug/engines/process-instance-summary',
      'engine-workspace/pane-providers/ProcessInstanceSummaryPane',
      ProcessInstanceSummaryPane,
    ),
    bifrost.panes.getPaneViaPaneProvider(
      'debug/engines/task-detail',
      'engine-workspace/pane-providers/TaskDetailPane',
      TaskDetailPane,
    ),
    bifrost.panes.getPaneViaPaneProvider(
      'debug/engines/decision-summary',
      'engine-workspace/pane-providers/DecisionSummaryPane',
      DecisionSummaryPane,
    ),
    bifrost.panes.getPaneViaPaneProvider(
      'debug/engines/schedule-detail',
      'engine-workspace/pane-providers/ScheduleDetailPane',
      ScheduleDetailPane,
    ),
  ]);
}

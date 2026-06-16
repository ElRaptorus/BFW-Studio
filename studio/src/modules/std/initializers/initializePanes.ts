import type { Bifrost } from '#bifrost/Bifrost';
import * as OpenEditorsPane from '#components/panes/activities/files/OpenEditorsPane';
import * as SolutionPane from '#components/panes/activities/files/SolutionPane';
import * as GlobalSearchPane from '#components/panes/activities/search/GlobalSearchPane';
import * as EditorDocumentInspector from '#components/panes/inspectors/EditorDocumentInspector';
import * as NotificationInspector from '#components/panes/inspectors/NotificationInspector';
import * as PerformanceInspector from '#components/panes/inspectors/PerformanceInspector';

export function initializePanes(bifrost: Bifrost): void {
  bifrost.panes.registerPaneGroup('left', 'explorer', [
    bifrost.panes.getPaneViaPaneProvider(
      'pane/left/open-editors',
      'std/pane-providers/activities/explorer/OpenEditorsPane',
      OpenEditorsPane,
    ),
    bifrost.panes.getPaneViaPaneProvider(
      'pane/left/explorer',
      'std/pane-providers/activities/explorer/SolutionPane',
      SolutionPane,
    ),
  ]);
  bifrost.panes.registerPaneGroup('left', 'search', [
    bifrost.panes.getPaneViaPaneProvider(
      'pane/left/search',
      'std/pane-providers/activities/search/GlobalSearchPane',
      GlobalSearchPane,
    ),
  ]);

  bifrost.panes.registerPaneGroup('right', 'property', [], { label: 'Properties', icon: 'ph ph-list-dashes' });
  bifrost.panes.registerPaneGroup('right', 'scripting', [], { label: 'Scripts', icon: 'ph ph-scroll' });
  bifrost.panes.registerPaneGroup('right', 'documentation', [], { label: 'Documentation', icon: 'ph ph-note-pencil' });
  bifrost.panes.registerPaneGroup('right', 'dataflow', [], { label: 'Data Flow', icon: 'ph ph-line-segment' });

  bifrost.panes.registerPaneGroup('bottom', 'inspectors', [
    bifrost.panes.getPaneViaPaneProvider(
      'inspectors/notification_inspector',
      'std/pane-providers/inspectors/NotificationInspector',
      NotificationInspector,
    ),
    bifrost.panes.getPaneViaPaneProvider(
      'inspectors/performance_inspector',
      'std/pane-providers/inspectors/PerformanceInspector',
      PerformanceInspector,
    ),
    bifrost.panes.getPaneViaPaneProvider(
      'inspectors/editor_document_inspector',
      'std/pane-providers/inspectors/EditorDocumentInspector',
      EditorDocumentInspector,
    ),
  ]);

  bifrost.panes.registerPaneGroup('bottom', 'console', [], { label: 'Debug Console', icon: 'ph ph-terminal' });
}

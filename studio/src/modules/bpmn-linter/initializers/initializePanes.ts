import type { Bifrost } from '#bifrost/Bifrost';

import type { FindingCounts } from '../types';

export const linterCounts: FindingCounts = { errors: 0, warnings: 0, infos: 0 };

function getLinterIconClass(): string {
  if (linterCounts.errors > 0) {
    return 'ph-fill ph-highlighter lint-severity--error';
  }
  if (linterCounts.warnings > 0) {
    return 'ph-fill ph-highlighter lint-severity--warning';
  }
  if (linterCounts.infos > 0) {
    return 'ph-fill ph-highlighter lint-severity--info';
  }
  return 'ph-fill ph-highlighter';
}

export function initializePanes(bifrost: Bifrost): void {
  bifrost.panes.registerPaneGroup(
    'right',
    'linter',
    [
      bifrost.panes.getPaneViaPaneProvider(
        'bpmn-linter/panes/LinterScorePane',
        'bpmn-linter/pane-providers/LinterScorePane',
        require('../panes/LinterScorePane'),
      ),
      bifrost.panes.getPaneViaPaneProvider(
        'bpmn-linter/panes/ProblemsPane',
        'bpmn-linter/pane-providers/ProblemsPane',
        require('../panes/ProblemsPane'),
      ),
    ],
    { label: 'Linter', icon: getLinterIconClass },
  );
}

import type { Bifrost } from '#bifrost/Bifrost';

import * as BkmDetailPane from '../panes/BkmDetailPane';
import * as DecisionDetailPane from '../panes/DecisionDetailPane';
import * as DecisionServiceDetailPane from '../panes/DecisionServiceDetailPane';
import * as DecisionTableDetailPane from '../panes/DecisionTableDetailPane';
import * as DefinitionInfoPane from '../panes/DefinitionInfoPane';
import * as ItemDefinitionDetailPane from '../panes/ItemDefinitionDetailPane';
import * as LiteralExpressionPane from '../panes/LiteralExpressionPane';

export default function initializePanes(bifrost: Bifrost): void {
  bifrost.panes.prependToPaneGroup('right', 'property', [
    bifrost.panes.getPaneViaPaneProvider(
      'pane/right/definition-info',
      'engine-decision-viewer/pane-providers/DefinitionInfoPane',
      DefinitionInfoPane,
    ),
    bifrost.panes.getPaneViaPaneProvider(
      'pane/right/decision-detail',
      'engine-decision-viewer/pane-providers/DecisionDetailPane',
      DecisionDetailPane,
    ),
    bifrost.panes.getPaneViaPaneProvider(
      'pane/right/decision-table-detail',
      'engine-decision-viewer/pane-providers/DecisionTableDetailPane',
      DecisionTableDetailPane,
    ),
    bifrost.panes.getPaneViaPaneProvider(
      'pane/right/literal-expression',
      'engine-decision-viewer/pane-providers/LiteralExpressionPane',
      LiteralExpressionPane,
    ),
    bifrost.panes.getPaneViaPaneProvider(
      'pane/right/bkm-detail',
      'engine-decision-viewer/pane-providers/BkmDetailPane',
      BkmDetailPane,
    ),
    bifrost.panes.getPaneViaPaneProvider(
      'pane/right/item-definition-detail',
      'engine-decision-viewer/pane-providers/ItemDefinitionDetailPane',
      ItemDefinitionDetailPane,
    ),
    bifrost.panes.getPaneViaPaneProvider(
      'pane/right/decision-service-detail',
      'engine-decision-viewer/pane-providers/DecisionServiceDetailPane',
      DecisionServiceDetailPane,
    ),
  ]);
}

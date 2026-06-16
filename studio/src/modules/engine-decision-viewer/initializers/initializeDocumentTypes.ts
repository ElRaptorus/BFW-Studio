import type { Bifrost } from '#bifrost/Bifrost';
import { checkEngineConnectivity } from '#modules/engine-core';

import { DecisionViewerDocumentModel } from '../models/DecisionViewerDocumentModel';
import DecisionViewerRenderer from '../renderers/DecisionViewerRenderer';

export default function initializeDocumentTypes(bifrost: Bifrost): void {
  bifrost.icons.registerIcons({
    'engine-decision-viewer/decision': 'ph-duotone ph-graph',
  });

  bifrost.editors.registerDocumentType('engine-decision-viewer', {
    uriMatch: /^engine-decision:\/\/[^/]+\/.+$/,
    modelKey: 'EngineDecisionViewerModel',
    modelConstructor: DecisionViewerDocumentModel,
    rendererKey: 'EngineDecisionViewerRenderer',
    rendererConstructor: DecisionViewerRenderer,
    icon: 'engine-decision-viewer/decision',
    canOpen: (uri: string) => checkEngineConnectivity(bifrost, uri),
  });
}

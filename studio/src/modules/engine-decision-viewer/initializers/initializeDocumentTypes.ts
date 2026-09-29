import type { Bifrost } from '#bifrost/Bifrost';
import type { EngineConnectionManager } from '#modules/engine-core';

import { DecisionViewerDocumentModel } from '../models/DecisionViewerDocumentModel';
import DecisionViewerRenderer from '../renderers/DecisionViewerRenderer';

export default function initializeDocumentTypes(bifrost: Bifrost, connectionManager: EngineConnectionManager): void {
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
    canOpen: (uri: string) => connectionManager.checkEngineConnectivity(uri),
  });
}

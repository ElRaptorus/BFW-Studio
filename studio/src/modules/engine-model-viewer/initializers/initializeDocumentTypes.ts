import type { Bifrost } from '#bifrost/Bifrost';
import { checkEngineConnectivity } from '#modules/engine-core';

import { ModelViewerDocumentModel } from '../models/ModelViewerDocumentModel';
import ModelViewerRenderer from '../renderers/ModelViewerRenderer';

export default function initializeDocumentTypes(bifrost: Bifrost): void {
  bifrost.icons.registerIcons({
    'engine-model-viewer/model': 'ph-duotone ph-flow-arrow',
  });

  bifrost.editors.registerDocumentType('engine-model-viewer', {
    uriMatch: /^engine-model:\/\/.+/,
    modelKey: 'EngineModelViewerModel',
    modelConstructor: ModelViewerDocumentModel,
    rendererKey: 'EngineModelViewerRenderer',
    rendererConstructor: ModelViewerRenderer,
    icon: 'engine-model-viewer/model',
    canOpen: (uri: string) => checkEngineConnectivity(bifrost, uri),
  });
}

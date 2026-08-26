import type { Bifrost } from '#bifrost/Bifrost';
import { Icon } from '#components/Icon';
import type { DmnImport } from '#modules/engine-decision-viewer/types/dmnModelTypes';

import React from 'react';

import { DECISION_VIEWER_COMMANDS } from '../commands/DecisionViewerCommands';
import './ImportChainPanel.scss';

interface ImportChainPanelProps {
  studio: Bifrost;
  engineId: string;
  imports: DmnImport[];
  currentModelName?: string;
}

export function ImportChainPanel(props: ImportChainPanelProps): React.JSX.Element | null {
  if (props.imports.length === 0) {
    return null;
  }

  const handleOpenImport = (importElement: DmnImport): void => {
    const importedModelId = extractModelIdFromLocation(importElement.locationUri) ?? importElement.namespace;
    void props.studio.commands.executeCommand(DECISION_VIEWER_COMMANDS.openImportedModel, [
      props.engineId,
      importedModelId,
    ]);
  };

  return (
    <div className="engine-import-chain-panel">
      <div className="engine-import-chain-panel__chain">
        <div className="engine-import-chain-panel__node engine-import-chain-panel__node--current">
          <Icon id="ph-duotone ph-graph" />
          <span>{props.currentModelName ?? 'This Model'}</span>
        </div>

        {props.imports.map((importElement) => (
          <React.Fragment key={importElement.id ?? importElement.namespace}>
            <div className="engine-import-chain-panel__arrow">
              <svg width="24" height="14" viewBox="0 0 24 14">
                <line x1="0" y1="7" x2="18" y2="7" stroke="currentColor" strokeWidth="1.5" />
                <polygon points="18,2 24,7 18,12" fill="currentColor" />
              </svg>
            </div>

            <button
              className="engine-import-chain-panel__node engine-import-chain-panel__node--import"
              onClick={() => handleOpenImport(importElement)}
              title={`Open "${importElement.namespace}" in Decision Viewer`}
            >
              <Icon id="ph ph-arrow-square-out" />
              <span className="engine-import-chain-panel__node-name">{importElement.namespace}</span>
              {importElement.locationUri && (
                <span className="engine-import-chain-panel__node-location">
                  {extractModelIdFromLocation(importElement.locationUri) ?? importElement.locationUri}
                </span>
              )}
            </button>
          </React.Fragment>
        ))}
      </div>
    </div>
  );
}

function extractModelIdFromLocation(locationUri: string | null): string | null {
  if (!locationUri) {
    return null;
  }
  const fileName = locationUri.split('/').pop();
  if (!fileName) {
    return null;
  }
  return fileName.replace(/\.dmn$/i, '');
}

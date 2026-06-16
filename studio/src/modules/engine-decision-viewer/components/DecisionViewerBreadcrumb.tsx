import { EngineContextBreadcrumb } from '#modules/engine-core';
import type { EngineHealthState } from '#modules/engine-core';

import React from 'react';

import type { Studio } from '@evil/bifrost_fw_sdk';

interface DecisionViewerBreadcrumbProps {
  studio: Studio;
  engineId: string;
  engineDisplayName: string;
  healthState?: EngineHealthState;
}

/**
 * Renders engine dashboard link followed by decision catalog link
 * for the Decision Viewer editor title sublabel (§7.7.2).
 */
export function DecisionViewerBreadcrumb(props: DecisionViewerBreadcrumbProps): React.JSX.Element {
  const handleCatalogClick = (event: React.MouseEvent) => {
    event.preventDefault();
    props.studio.editors.focusOrOpenEditorDocument(`engine://decisions/${props.engineId}`, 'Decisions');
  };

  return (
    <span className="engine-decision-viewer-breadcrumb">
      <EngineContextBreadcrumb
        studio={props.studio}
        engineId={props.engineId}
        engineDisplayName={props.engineDisplayName}
        healthState={props.healthState}
      />
      <span className="engine-decision-viewer-breadcrumb__separator"> → </span>
      <a
        className="engine-decision-viewer-breadcrumb__catalog"
        href="#"
        onClick={handleCatalogClick}
        title="Navigate to Decision Catalog"
      >
        Decisions
      </a>
    </span>
  );
}

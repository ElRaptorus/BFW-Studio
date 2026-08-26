import type { Bifrost } from '#bifrost/Bifrost';

import React from 'react';

import type { EngineHealthState } from './EngineHealthBadge';
import { EngineHealthBadge } from './EngineHealthBadge';

interface EngineContextBreadcrumbProps {
  studio: Bifrost;
  engineId: string;
  engineDisplayName: string;
  healthState?: EngineHealthState;
}

/**
 * Renders a clickable sublabel that navigates to the engine's dashboard,
 * with an optional inline health badge after the engine name.
 * Used in the EditorTitleLeft slot of every engine view for multi-engine
 * context disambiguation and one-click engine-level navigation (§7.7.1).
 */
export const EngineContextBreadcrumb: React.FC<EngineContextBreadcrumbProps> = ({
  studio,
  engineId,
  engineDisplayName,
  healthState,
}) => {
  const handleClick = (event: React.MouseEvent) => {
    event.preventDefault();
    studio.editors.focusOrOpenEditorDocument(`engine://dashboard/${engineId}`, engineDisplayName);
  };

  return (
    <span className="engine-context-breadcrumb-wrapper">
      <a
        className="engine-context-breadcrumb"
        href="#"
        onClick={handleClick}
        title={`Navigate to ${engineDisplayName} dashboard`}
      >
        {engineDisplayName}
      </a>
      {healthState && <EngineHealthBadge healthState={healthState} inline />}
    </span>
  );
};

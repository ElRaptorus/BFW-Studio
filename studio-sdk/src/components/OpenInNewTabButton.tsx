import React from 'react';

import type { Studio } from '../../index';
import { getUrlForOpenInNewTab } from '../../index';
import { Icon } from './internal/Icon';

type OpenInNewTabButtonProps = {
  studio: Studio;
  type: string;
  parentUri: string;
  fragmentId: string;
  additionalData?: any;
  className?: string;
  id?: string;
  dataTest?: string;
};

export function OpenInNewTabButton({
  studio,
  type,
  parentUri,
  fragmentId,
  additionalData,
  className,
  id,
  dataTest,
}: OpenInNewTabButtonProps): React.JSX.Element {
  const handleClick = (event: React.MouseEvent) => {
    const uri = getUrlForOpenInNewTab(type, parentUri, fragmentId, additionalData ?? {});

    if (event.shiftKey) {
      studio.commands.executeCommand('std.editor.openDocumentToTheSide', [uri]);
    } else {
      studio.commands.executeCommand('std.editor.focusOrOpenDocument', [uri]);
    }
  };

  return (
    <span
      id={id ?? ''}
      className={`pane-header__icon open-in-new-tab-button ${className ?? ''}`}
      onClick={handleClick}
      title="Open in new tab (Shift+Click to open to the side)"
      data-bs-toggle="tooltip"
      {...(dataTest ? { [`data-test--${dataTest}`]: true } : {})}
    >
      <Icon id="ph ph-arrow-square-out ph-lg" />
    </span>
  );
}

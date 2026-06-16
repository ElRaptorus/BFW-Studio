import React from 'react';

import type { Studio } from '../../../types/Studio';
import { Icon } from '../internal/Icon';

type PaneHeaderHelpIconProps = {
  studio: Studio;
  id: string;
  tooltip?: string;
};

export function PaneHeaderHelpIcon(props: PaneHeaderHelpIconProps): React.JSX.Element {
  const studio: Studio = props.studio;
  const cmd = studio.commands.getClickHandler();
  const tooltip = props.tooltip ?? 'Help';

  return (
    <a
      className="pane-header__icon"
      onClick={cmd('std.help.open', [props.id])}
      href="#"
      title={tooltip}
      data-bs-toggle="tooltip"
      tabIndex={0}
    >
      <Icon id="std/help" />
    </a>
  );
}

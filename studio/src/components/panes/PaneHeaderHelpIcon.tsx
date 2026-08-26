import type { Bifrost } from '#bifrost/Bifrost';

import React from 'react';

import { Icon } from '../Icon';

type PaneHeaderHelpIconProps = {
  studio: Bifrost;
  id: string;
  tooltip?: string;
};

export function PaneHeaderHelpIcon(props: PaneHeaderHelpIconProps): React.JSX.Element {
  const studio: Bifrost = props.studio;
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

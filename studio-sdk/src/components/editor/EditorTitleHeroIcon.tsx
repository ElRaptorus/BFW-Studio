import React from 'react';

import type { Studio } from '../../../types/Studio';
import { Icon } from '../internal/Icon';

type EditorTitleIconProps = {
  className?: string;
  studio: Studio;
  icon: string;
};

export function EditorTitleHeroIcon(props: EditorTitleIconProps): React.JSX.Element {
  return (
    <div className={`editor-title__icon ${props.className || ''}`}>
      <Icon id={props.icon} />
    </div>
  );
}

import type { Bifrost } from '#bifrost/Bifrost';

import React from 'react';

import { Icon } from '../Icon';

type EditorTitleIconProps = {
  className?: string;
  studio: Bifrost;
  icon: string;
};

export function EditorTitleHeroIcon(props: EditorTitleIconProps): React.JSX.Element {
  return (
    <div className={`editor-title__icon ${props.className || ''}`}>
      <Icon id={props.icon} />
    </div>
  );
}

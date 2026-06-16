import type { Bifrost } from '#bifrost/Bifrost';
import type { StatusBarItem_Divider } from '#bifrost/contracts/StatusBarTypes';

import React from 'react';

type StatusBarDividerProps = {
  bifrost: Bifrost;
  item: StatusBarItem_Divider;
  htmlAttributes: any;
};

export default function StatusBarDivider(props: StatusBarDividerProps): React.JSX.Element {
  return <div className="status-bar__divider" {...props.htmlAttributes} />;
}

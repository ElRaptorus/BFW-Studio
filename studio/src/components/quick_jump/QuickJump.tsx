import type { QuickJumpViewMediator } from '#bifrost/browser/QuickJumpViewMediator';
import { assertNotNull } from '#bifrost/common/AssertionFunctions';
import type { IconComponent } from '#bifrost/contracts/IconTypes';
import type { QuickJumpItem } from '#bifrost/contracts/QuickJumpTypes';

import React, { useEffect, useRef } from 'react';

import QuickJumpRenderer from './QuickJumpRenderer';

type QuickJumpProps = {
  iconComponent: IconComponent;
  quickJump: QuickJumpViewMediator;
  visible: boolean;
  prompt: string;
  initialInputValue: string;
  filteredEntries: QuickJumpItem[];
  selectedIndex: number;
};

export default function QuickJump(props: QuickJumpProps): React.JSX.Element {
  const htmlElementRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    assertNotNull(htmlElementRef.current, 'htmlElementRef.current');
    const element = htmlElementRef.current.querySelector<HTMLDivElement>('.quick-jump__input');
    if (element != null) {
      element.focus();
    }
  }, []);

  return (
    <div className="quick-jump__container kbm-quick-jump std-quick-jump" data-test--quick-jump ref={htmlElementRef}>
      <QuickJumpRenderer
        iconComponent={props.iconComponent}
        prompt={props.prompt}
        initialInputValue={props.initialInputValue || ''}
        entries={props.filteredEntries}
        selectedIndex={props.selectedIndex}
        setQuery={(query: string) => props.quickJump.setQuery(query)}
        onBlur={() => props.quickJump.hideWithDelay()}
        openEntryAndClose={(entry: QuickJumpItem, event: any) => props.quickJump.openEntryAndClose(entry)}
        openSelectedEntryAndClose={(event: any) => props.quickJump.openSelectedEntryAndClose()}
      />
    </div>
  );
}

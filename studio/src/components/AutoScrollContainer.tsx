import { assertNotNull } from '#bifrost/common/AssertionFunctions';

import type { PropsWithChildren } from 'react';
import React, { useEffect, useRef } from 'react';

type AutoScrollContainerProps = PropsWithChildren<{
  className?: string;
  elementClassName: string;
  tabIndex?: number;
}>;

/**
 * Provides a container that automatically keeps the HTML element with the given `elementClassName` in view.
 */
export function AutoScrollContainer(props: AutoScrollContainerProps): React.JSX.Element {
  const ref = useRef<HTMLDivElement>(null);

  const componentIsMountedRef = useRef(false);

  useEffect(() => {
    if (componentIsMountedRef.current) {
      const scrollableContainer = ref.current;
      assertNotNull(scrollableContainer, 'scrollableContainer');

      const element = scrollableContainer.getElementsByClassName(props.elementClassName)[0] as HTMLElement;

      if (element == null) {
        return;
      }

      ensureVisibilityHorizontally(scrollableContainer, element);
      ensureVisibilityVertically(scrollableContainer, element);
    } else {
      componentIsMountedRef.current = true;
    }
  });

  return (
    <div className={props.className} tabIndex={props.tabIndex} ref={ref} style={{ position: 'relative' }}>
      {props.children}
    </div>
  );
}

function ensureVisibilityHorizontally(scrollableContainer: HTMLElement, element: HTMLElement): void {
  const leftEdgeOfElementRelativeToList = element.offsetLeft - scrollableContainer.scrollLeft;
  if (leftEdgeOfElementRelativeToList < 0) {
    scrollableContainer.scrollBy({ left: leftEdgeOfElementRelativeToList });
  }

  const rightEdgeOfElement = element.offsetLeft + element.offsetWidth;
  const rightEdgeOfContainer = scrollableContainer.scrollLeft + scrollableContainer.offsetWidth;
  if (rightEdgeOfElement > rightEdgeOfContainer) {
    scrollableContainer.scrollBy({ left: rightEdgeOfElement - rightEdgeOfContainer });
  }
}

function ensureVisibilityVertically(scrollableContainer: HTMLElement, element: HTMLElement): void {
  const topEdgeOfElementRelativeToList = element.offsetTop - scrollableContainer.scrollTop;
  if (topEdgeOfElementRelativeToList < 0) {
    scrollableContainer.scrollBy({ top: topEdgeOfElementRelativeToList });
  }

  const bottomEdgeOfElement = element.offsetTop + element.offsetHeight;
  const bottomEdgeOfContainer = scrollableContainer.scrollTop + scrollableContainer.offsetHeight;
  if (bottomEdgeOfElement > bottomEdgeOfContainer) {
    scrollableContainer.scrollBy({ top: bottomEdgeOfElement - bottomEdgeOfContainer });
  }
}

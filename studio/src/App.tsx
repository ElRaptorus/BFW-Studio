import '#bifrost/browser/BootstrapInitializer';
import { EVENT_THEME_CHANGED } from '#bifrost/contracts/internal/ThemeEvents';
import { ContextMenuPortal } from '#components/ContextMenuPortal';
import Workbench from '#components/Workbench';
import { DndProvider } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';

import React, { useCallback, useEffect, useRef, useState } from 'react';

import { useBifrost } from './bifrostContext';

function BifrostApp() {
  const bifrost = useBifrost();
  const rootRef = useRef<HTMLDivElement>(null);

  const [themeId, setThemeId] = useState(bifrost.theme.getCurrentTheme());
  const testingProps = { 'data-test--workbench--theme': themeId };
  const themeClassName = bifrost.theme.getThemeClassNames(themeId);

  const onRootRef = useCallback(
    (element: HTMLDivElement | null) => {
      (rootRef as React.RefObject<HTMLDivElement | null>).current = element;
      if (element != null) {
        bifrost.theme.setRootElement(element);
      }
    },
    [bifrost.theme],
  );

  useEffect(() => {
    const themeSubscription = bifrost.theme.on(EVENT_THEME_CHANGED, (newThemeId: string) => {
      setThemeId(newThemeId);
    });

    return () => {
      themeSubscription.dispose();
    };
  }, [bifrost.theme]);

  useEffect(() => {
    const preventDefaultDrag = (event: Event) => event.preventDefault();
    document.addEventListener('dragover', preventDefaultDrag);
    document.addEventListener('drop', preventDefaultDrag);
    return () => {
      document.removeEventListener('dragover', preventDefaultDrag);
      document.removeEventListener('drop', preventDefaultDrag);
    };
  }, []);

  return (
    <div ref={onRootRef} className={themeClassName} style={{ height: '100%' }} {...testingProps}>
      <ContextMenuPortal studio={bifrost} />
      <Workbench />
    </div>
  );
}

export default function App(): React.JSX.Element {
  return (
    <DndProvider backend={HTML5Backend}>
      <BifrostApp />
    </DndProvider>
  );
}

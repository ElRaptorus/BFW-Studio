import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';

import type { ContextMenuState, Menu, Studio } from '@evil/bifrost_fw_sdk';
import { ContextMenuStore } from '@evil/bifrost_fw_sdk';

import { renderBifrostMenu } from './ContextMenu';
import { ErrorBoundaryWithMessage } from './ErrorBoundaryWithMessage';

type ContextMenuPortalProps = {
  studio: Studio;
};

export function ContextMenuPortal({ studio }: ContextMenuPortalProps): React.JSX.Element | null {
  const [state, setState] = useState<ContextMenuState>(ContextMenuStore.getState());

  useEffect(() => {
    return ContextMenuStore.subscribe(setState);
  }, []);

  if (state == null) {
    return null;
  }

  return (
    <>
      <div
        className="react-contextmenu__backdrop"
        onClick={() => ContextMenuStore.hide()}
        onContextMenu={(e) => {
          e.preventDefault();
          ContextMenuStore.hide();
        }}
      />
      <PositionedMenu studio={studio} x={state.x} y={state.y} menuId={state.menuId} menuArgs={state.menuArgs} />
    </>
  );
}

type PositionedMenuProps = {
  studio: Studio;
  x: number;
  y: number;
  menuId: string;
  menuArgs: any[];
};

function PositionedMenu({ studio, x, y, menuId, menuArgs }: PositionedMenuProps): React.JSX.Element | null {
  const menuRef = useRef<HTMLElement>(null);
  const [position, setPosition] = useState<{ x: number; y: number } | null>(null);
  const [menu, setMenu] = useState<Menu | undefined>(() => {
    const result = studio.menus.getMenu(menuId, menuArgs);
    if (result instanceof Promise) {
      return undefined;
    }
    return result;
  });

  useEffect(() => {
    const result = studio.menus.getMenu(menuId, menuArgs);
    if (result instanceof Promise) {
      let cancelled = false;
      result.then((resolved) => {
        if (!cancelled) {
          setMenu(resolved);
        }
      });
      return () => {
        cancelled = true;
      };
    }
  }, [menuId, menuArgs, studio]);

  useLayoutEffect(() => {
    if (menu == null || menuRef.current == null) {
      return;
    }

    const el = menuRef.current;
    const rect = el.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    let finalX = x;
    let finalY = y;

    if (finalY + rect.height > vh) {
      finalY = y - rect.height;
    }
    if (finalX + rect.width > vw) {
      finalX = x - rect.width;
    }

    finalX = Math.max(0, finalX);
    finalY = Math.max(0, finalY);

    setPosition({ x: finalX, y: finalY });
  }, [menu, x, y]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') {
        ContextMenuStore.hide();
        return;
      }

      if (menuRef.current == null) {
        return;
      }

      const selector = [
        ':scope > .react-contextmenu-item[role="menuitem"]:not(.react-contextmenu-item--disabled)',
        ':scope > .react-contextmenu-submenu > .react-contextmenu-item[role="menuitem"]',
      ].join(', ');
      const items = Array.from(menuRef.current.querySelectorAll<HTMLElement>(selector));
      if (items.length === 0) {
        return;
      }

      const focused = document.activeElement as HTMLElement;
      const currentIndex = items.indexOf(focused);

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        const next = currentIndex < items.length - 1 ? currentIndex + 1 : 0;
        items[next].focus();
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        const prev = currentIndex > 0 ? currentIndex - 1 : items.length - 1;
        items[prev].focus();
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (currentIndex >= 0) {
          items[currentIndex].click();
        }
      }
    };

    const onScroll = (): void => {
      ContextMenuStore.hide();
    };

    document.addEventListener('keydown', onKeyDown);

    // Delay scroll listener to avoid dismissing from layout-induced scrolls
    // (e.g. setActiveProcessInstance triggering a re-render/scroll adjustment)
    const scrollTimerId = setTimeout(() => {
      window.addEventListener('scroll', onScroll, true);
    }, 100);

    return () => {
      clearTimeout(scrollTimerId);
      document.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('scroll', onScroll, true);
    };
  }, []);

  if (menu == null) {
    return null;
  }

  const isPositioned = position != null;
  const style: React.CSSProperties = {
    position: 'fixed',
    left: isPositioned ? position.x : x,
    top: isPositioned ? position.y : y,
    opacity: isPositioned ? 1 : 0,
    pointerEvents: isPositioned ? 'auto' : 'none',
    zIndex: 9999,
  };

  return (
    <nav
      ref={menuRef}
      role="menu"
      tabIndex={-1}
      className={`react-contextmenu ${isPositioned ? 'react-contextmenu--visible' : ''}`}
      style={style}
    >
      <ErrorBoundaryWithMessage>{renderBifrostMenu(menu, studio)}</ErrorBoundaryWithMessage>
    </nav>
  );
}

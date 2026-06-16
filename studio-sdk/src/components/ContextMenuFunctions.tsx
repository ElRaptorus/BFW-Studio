import type React from 'react';

import { ContextMenuStore } from './ContextMenuStore';

/**
 * Displays the context menu with the given `menuId` using the given `menuArgs` at the position of `mouseEvent`.
 *
 *      // usage in React
 *      <div onContextMenu={(event) => showContextMenu(event, 'example-menu', ['test', 42])}>
 *        right click here for the registered menu as Contextmenu
 *      </div>
 *
 *      // given that `example-menu` was registered in the module's onLoad function
 *      export function onLoad(studio: Studio): void {
 *        studio.menus.registerMenu('example-menu', (arg1: string, arg2: number) => {
 *          return [
 *            {
 *              type: 'command',
 *              label: `${arg1} ${arg2}`,
 *              command: 'std.internal.empty'
 *            }
 *          ]
 *        })
 *      }
 */
export async function showContextMenu(
  mouseEvent: MouseEvent | React.MouseEvent | any,
  menuId: string,
  menuArgs: any[] = [],
): Promise<void> {
  mouseEvent.preventDefault();
  mouseEvent.stopPropagation();

  const x =
    mouseEvent.clientX > 0 || mouseEvent.clientY > 0 ? mouseEvent.clientX : Math.abs(mouseEvent.nativeEvent.layerX);
  const y =
    mouseEvent.clientY > 0 || mouseEvent.clientX > 0 ? mouseEvent.clientY : Math.abs(mouseEvent.nativeEvent.layerY);

  ContextMenuStore.hide();
  ContextMenuStore.show(x, y, menuId, menuArgs);
}

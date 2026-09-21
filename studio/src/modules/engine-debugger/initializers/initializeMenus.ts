import type { Bifrost } from '#bifrost/Bifrost';

import type { Menu, MenuItem } from '@elraptorus/bfw_studio_sdk';

import {
  DataObjectDetailLevel,
  hideAllAssociations,
  hideAllDataObjectDetails,
  hideReadingAssociations,
  showAllDataObjectDetails,
} from '../../bpmn-core/DataObjectDetailsSettings';

export function initializeMenus(bifrost: Bifrost): void {
  bifrost.menus.registerMenuModifier(
    'std/application/main',
    async (mainMenu: Promise<Menu>, bifrost: Bifrost): Promise<Menu> => {
      const newMenuItems: MenuItem[] = [
        {
          type: 'menu',
          label: 'Engine Debugger',
          id: 'view/engine-debugger',
          submenu: [
            {
              type: 'menu',
              id: 'view/engine-debugger/overlays',
              label: 'Overlays',
              submenu: [
                {
                  type: 'command',
                  label: 'Documentation Marker',
                  id: 'view/engine-debugger/overlays/documentation',
                  checked: bifrost.settings.get('engineDebugger.viewer.showDocumentationMarker'),
                  command: 'engine.debugger.toggleDocumentationDisplay',
                },
                {
                  type: 'command',
                  label: 'Multiple Outgoing Sequence Flows Markers',
                  id: 'view/engine-debugger/overlays/multiple-outgoing-sequence-flows',
                  checked: bifrost.settings.get('engineDebugger.viewer.showMultipleOutgoingSequenceFlowsMarkers'),
                  command: 'engine.debugger.toggleMultipleOutgoingSequenceFlowsDisplay',
                },
              ],
            },
            {
              type: 'menu',
              label: 'Data Object Detail Level',
              id: 'view/bpmn-elements/data-object-details-debugger',
              submenu: [
                {
                  type: 'command',
                  label: 'Show everything',
                  checked: showAllDataObjectDetails(
                    bifrost.settings.get('engineDebugger.viewer.dataObjectDetailLevel'),
                  ),
                  id: 'view/bpmn-elements/data-object-details-debugger/show-everything',
                  command: 'engine.debugger.setDataObjectDetailLevel',
                  commandArgs: [DataObjectDetailLevel.showAll],
                },
                {
                  type: 'command',
                  label: 'Hide input associations',
                  checked: hideReadingAssociations(bifrost.settings.get('engineDebugger.viewer.dataObjectDetailLevel')),
                  id: 'view/bpmn-elements/data-object-details-debugger/hide-input-associations',
                  command: 'engine.debugger.setDataObjectDetailLevel',
                  commandArgs: [DataObjectDetailLevel.hideInputAssociations],
                },
                {
                  type: 'command',
                  label: 'Hide all associations',
                  checked: hideAllAssociations(bifrost.settings.get('engineDebugger.viewer.dataObjectDetailLevel')),
                  id: 'view/bpmn-elements/data-object-details-debugger/hide-all-associations',
                  command: 'engine.debugger.setDataObjectDetailLevel',
                  commandArgs: [DataObjectDetailLevel.hideAllAssociations],
                },
                {
                  type: 'command',
                  label: 'Hide everything',
                  checked: hideAllDataObjectDetails(
                    bifrost.settings.get('engineDebugger.viewer.dataObjectDetailLevel'),
                  ),
                  id: 'view/bpmn-elements/data-object-details-debugger/hide-everything',
                  command: 'engine.debugger.setDataObjectDetailLevel',
                  commandArgs: [DataObjectDetailLevel.hideAll],
                },
              ],
            },
          ],
        },
      ];

      const menu = await mainMenu;
      return bifrost.menus.insertAfterMenuItem(menu, 'view/bpmn-editor', newMenuItems);
    },
  );
}

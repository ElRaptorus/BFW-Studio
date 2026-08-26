import type { Bifrost } from '#bifrost/Bifrost';
import { assertNotNull } from '#bifrost/common/AssertionFunctions';
import { BpmnElementType } from '#modules/bpmn-editor/BpmnElementTypes';

import type { Menu, MenuItem } from '@evil/bifrost_fw_sdk';

import {
  DataObjectDetailLevel,
  hideAllAssociations,
  hideAllDataObjectDetails,
  hideReadingAssociations,
  showAllDataObjectDetails,
} from '../../bpmn-core/DataObjectDetailsSettings';
import type BpmnDocumentModel from '../BpmnDocumentModel';
import { assertBpmnElementIsCallActivity } from '../panes/BpmnElementTypeAssertionFunctions';

export function initializeBpmnMenus(bifrost: Bifrost): void {
  bifrost.menus.registerMenuModifier(
    'std/application/main',
    async (mainMenu: Promise<Menu>, bifrost: Bifrost): Promise<Menu> => {
      const newMenuItems: MenuItem[] = [
        {
          type: 'divider',
        },
        {
          type: 'menu',
          label: 'BPMN Editor',
          id: 'view/bpmn-editor',
          submenu: [
            {
              type: 'command',
              label: 'Show BPMN Grid',
              checked: bifrost.settings.get('bpmn.editor.showGrid'),
              id: 'view/bpmn-editor/show-grid',
              command: 'bpmn.editor.toggleShowGrid',
            },
            {
              type: 'command',
              label: 'Show internal custom properties',
              checked: bifrost.settings.get('bpmn.editor.showInternalCustomProperties'),
              id: 'view/bpmn-editor/show-internal-custom-properties',
              command: 'bpmn.editor.toggleShowInternalCustomProperties',
            },
            {
              type: 'divider',
            },
            {
              type: 'menu',
              id: 'view/bpmn-editor/overlays',
              label: 'Overlays',
              submenu: [
                {
                  type: 'command',
                  label: 'Documentation',
                  id: 'view/bpmn-editor/documentation-marker',
                  checked: bifrost.settings.get('bpmn.editor.showDocumentationMarker'),
                  command: 'bpmn.editor.showDocumentationMarker',
                },
                {
                  type: 'command',
                  label: 'Multiple Outgoing Sequence Flows',
                  id: 'view/bpmn-editor/multiple-outgoing-sequence-flows-markers',
                  checked: bifrost.settings.get('bpmn.editor.showMultipleOutgoingSequenceFlowsMarkers'),
                  command: 'bpmn.editor.showMultipleOutgoingSequenceFlowsMarkers',
                },
              ],
            },
            {
              type: 'menu',
              label: 'Data Object Detail Level',
              id: 'view/bpmn-editor/data-object-details-editor',
              submenu: [
                {
                  type: 'command',
                  label: 'Show everything',
                  checked: showAllDataObjectDetails(bifrost.settings.get('bpmn.editor.dataObjectDetailLevel')),
                  id: 'view/bpmn-editor/data-object-details-editor/show-everything',
                  command: 'bpmn.editor.setDataObjectDetailLevel',
                  commandArgs: [DataObjectDetailLevel.showAll],
                },
                {
                  type: 'command',
                  label: 'Hide input associations',
                  checked: hideReadingAssociations(bifrost.settings.get('bpmn.editor.dataObjectDetailLevel')),
                  id: 'view/bpmn-editor/data-object-details-editor/hide-input-associations',
                  command: 'bpmn.editor.setDataObjectDetailLevel',
                  commandArgs: [DataObjectDetailLevel.hideInputAssociations],
                },
                {
                  type: 'command',
                  label: 'Hide all associations',
                  checked: hideAllAssociations(bifrost.settings.get('bpmn.editor.dataObjectDetailLevel')),
                  id: 'view/bpmn-editor/data-object-details-editor/hide-all-associations',
                  command: 'bpmn.editor.setDataObjectDetailLevel',
                  commandArgs: [DataObjectDetailLevel.hideAllAssociations],
                },
                {
                  type: 'command',
                  label: 'Hide everything',
                  checked: hideAllDataObjectDetails(bifrost.settings.get('bpmn.editor.dataObjectDetailLevel')),
                  id: 'view/bpmn-editor/data-object-details-editor/hide-everything',
                  command: 'bpmn.editor.setDataObjectDetailLevel',
                  commandArgs: [DataObjectDetailLevel.hideAll],
                },
              ],
            },
          ],
        },
      ];

      const menu = await mainMenu;
      return bifrost.menus.insertAfterMenuItem(menu, 'view/editor-tabs', newMenuItems);
    },
  );

  bifrost.menus.registerMenu('bpmn/element', async (elementId: string): Promise<Menu> => {
    const editorDocument = bifrost.editors.getFocusedEditorDocument();
    assertNotNull(editorDocument, 'editorDocument');
    const editorDocumentModel: BpmnDocumentModel | null =
      bifrost.editors.getEditorDocumentModelIfPresent(editorDocument);

    const baseMenuForElement: Menu = [
      {
        type: 'command',
        label: `Copy`,
        id: 'bpmn/element/copy-selected-elements',
        command: 'bpmn.editor.copySelectedElements',
      },
      {
        type: 'command',
        label: `Paste`,
        id: 'bpmn/element/paste-elements',
        command: 'bpmn.editor.pasteElements',
      },
      {
        type: 'command',
        label: `Delete`,
        id: 'bpmn/element/delete-selected-elements',
        command: 'bpmn.editor.deleteSelectedElements',
      },
    ];

    if (editorDocumentModel == null) {
      return baseMenuForElement;
    }

    const element = editorDocumentModel.elements.getById(elementId);
    const additionalMenu: Menu = [];

    if (element?.type === BpmnElementType.CallActivity) {
      assertBpmnElementIsCallActivity(element);

      const processes = await bifrost.symbolIndex.getAll({ type: 'bpmn:Process' });
      const process = processes.find((process) => process.id === element.processModelId);

      if (process != null) {
        if (element.startEventId) {
          additionalMenu.push({
            type: 'command',
            label: 'Go to called process',
            id: 'bpmn/element/go-to-called-process',
            command: 'std.editor.gotoSymbolInDocument',
            commandArgs: [process.uri, element.startEventId],
          });
        } else {
          additionalMenu.push({
            type: 'command',
            label: 'Go to called process',
            id: 'bpmn/element/go-to-called-process',
            command: 'std.editor.focusOrOpenDocument',
            commandArgs: [process.uri],
          });
        }
      }
    }

    if (element != null) {
      additionalMenu.push({
        type: 'command',
        label: 'Open element in text editor',
        id: 'bpmn/element/open-element-in-text-editor',
        command: 'bpmn.editor.openElementInTextEditor',
        commandArgs: [editorDocument, elementId],
      });
    }

    if (additionalMenu.length !== 0) {
      return [
        ...baseMenuForElement,
        {
          type: 'divider',
        },
        ...additionalMenu,
      ];
    }

    return baseMenuForElement;
  });

  bifrost.menus.registerMenu('bpmn/editor-toolbar/alignment', (): Menu => {
    return [
      {
        type: 'command',
        label: 'Align to the left',
        id: 'bpmn/editor-toolbar/alignment/align-left',
        icon: 'ph ph-align-left',
        command: 'bpmn.editor.alignSelectedElementsLeft',
      },
      {
        type: 'command',
        label: 'Align to the center',
        id: 'bpmn/editor-toolbar/alignment/align-center',
        icon: 'ph ph-align-center-horizontal',
        command: 'bpmn.editor.alignSelectedElementsCenter',
      },
      {
        type: 'command',
        label: 'Align to the right',
        id: 'bpmn/editor-toolbar/alignment/align-right',
        icon: 'ph ph-align-right',
        command: 'bpmn.editor.alignSelectedElementsRight',
      },
      {
        type: 'divider',
      },
      {
        type: 'command',
        label: 'Align to the top',
        id: 'bpmn/editor-toolbar/alignment/align-top',
        icon: 'ph ph-align-top',
        command: 'bpmn.editor.alignSelectedElementsTop',
      },
      {
        type: 'command',
        label: 'Align to the middle',
        id: 'bpmn/editor-toolbar/alignment/align-middle',
        icon: 'ph ph-align-center-vertical',
        command: 'bpmn.editor.alignSelectedElementsMiddle',
      },
      {
        type: 'command',
        label: 'Align to the bottom',
        id: 'bpmn/editor-toolbar/alignment/align-bottom',
        icon: 'ph ph-align-bottom',
        command: 'bpmn.editor.alignSelectedElementsBottom',
      },
      {
        type: 'divider',
      },
      {
        type: 'command',
        label: 'Distribute horizontally',
        id: 'bpmn/editor-toolbar/alignment/distribute-horizontally',
        icon: 'ph ph-arrows-out-line-horizontal',
        command: 'bpmn.editor.distributeSelectedElementsHorizontally',
      },
      {
        type: 'command',
        label: 'Distribute vertically',
        id: 'bpmn/editor-toolbar/alignment/distribute-vertically',
        icon: 'ph ph-arrows-out-line-vertical',
        command: 'bpmn.editor.distributeSelectedElementsVertically',
      },
    ];
  });
}

import type { Studio } from '@evil/bifrost_fw_sdk';

import type EngineBpmnDebuggerEditorDocumentModel from '../../EngineBpmnDebuggerEditorDocumentModel';

class CustomContextPadProvider {
  static $inject: string[] = ['contextPad', 'popupMenu'];

  private contextPad: any;
  private popupMenu: any;
  private model!: EngineBpmnDebuggerEditorDocumentModel;
  private studio!: Studio;

  private constructor(contextPad: any, popupMenu: any) {
    this.contextPad = contextPad;
    this.popupMenu = popupMenu;
    contextPad.registerProvider(this);
  }

  configure(model: EngineBpmnDebuggerEditorDocumentModel, studio: Studio): void {
    this.model = model;
    this.studio = studio;
  }

  getContextPadEntries(element) {
    return (entries) => {
      const selectedFlowNodeInstance = this.model.selectedFlowNodeInstance;
      const flowNodeModel = this.model.flowNodesWithInstances.find((flowNode) => flowNode.id === element.id);

      entries = {};

      if (flowNodeModel != null) {
        entries = {
          ['custom.show-instance-details']: {
            group: 'details',
            className: 'ph ph-list-dashes',
            title: 'Runtime Data',
            action: {
              click: (event, element) => {
                const position = {
                  ...this.getReplaceMenuPosition(element),
                  cursor: { x: event.x, y: event.y },
                };

                this.popupMenu.open(selectedFlowNodeInstance, 'debugger-flow-node-instance-details', position, {
                  title: 'Flow Node Instance',
                  width: 300,
                });
              },
            },
          },
          ['custom.open-expression-runner']: {
            group: 'debug',
            className: 'ph ph-terminal',
            title: 'Open Expression Runner',
            action: {
              click: () => this.onClickOpenExpressionRunner(),
            },
          },
        };
      }

      return entries;
    };
  }

  private getReplaceMenuPosition(element) {
    const Y_OFFSET = 5;
    const pad = this.contextPad.getPad(element).html;

    const padRect = pad.getBoundingClientRect();

    const pos = {
      x: padRect.left,
      y: padRect.bottom + Y_OFFSET,
    };

    return pos;
  }

  private onClickOpenExpressionRunner() {
    this.studio.commands.executeCommand('engine.debugger.workbench.openAndFocusExpressionRunner');
  }
}

export default {
  __init__: ['customContextPadProvider'],
  customContextPadProvider: ['type', CustomContextPadProvider],
};

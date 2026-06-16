import type { FlowNodeInstance } from '@elraptorus/daemonengine_sdk';

import type { Studio } from '@evil/bifrost_fw_sdk';

import type EngineBpmnDebuggerEditorDocumentModel from '../../EngineBpmnDebuggerEditorDocumentModel';

class CustomPopupProvider {
  static $inject: string[] = ['config', 'popupMenu', 'translate'];

  private model!: EngineBpmnDebuggerEditorDocumentModel;
  private studio!: Studio;
  private popupMenu;

  constructor(config, popupMenu) {
    this.popupMenu = popupMenu;
    popupMenu.registerProvider('debugger-flow-node-instance-details', this);
  }

  configure(model: EngineBpmnDebuggerEditorDocumentModel, studio: Studio): void {
    this.model = model;
    this.studio = studio;
  }

  getPopupMenuEntries(flowNodeInstance: FlowNodeInstance) {
    return (entries) => {
      return entries;
    };
  }

  getPopupMenuHeaderEntries(flowNodeInstance: FlowNodeInstance) {
    return (entries) => {
      return entries;
    };
  }
}

export default {
  __init__: ['customPopupProvider'],
  customPopupProvider: ['type', CustomPopupProvider],
};

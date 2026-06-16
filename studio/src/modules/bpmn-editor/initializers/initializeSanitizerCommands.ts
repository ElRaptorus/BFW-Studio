import type { Bifrost } from '#bifrost/Bifrost';

import type { BpmnDocumentModel } from '@evil/bifrost_fw_sdk/types/BpmnDocumentModel';

import { buildSanitizerFixCommands } from '../../bpmn-core/sanitizer/BpmnSanitizerFixer';
import type { SanitizerBridgeApi } from '../../bpmn-core/sanitizer/SanitizerBridge';
import type { SanitizableIssue } from '../../bpmn-core/sanitizer/sanitizerTypes';

function getSanitizerBridge(bifrost: Bifrost): SanitizerBridgeApi | null {
  const doc = bifrost.editors.getFocusedEditorDocument();
  if (!doc || doc.documentType !== 'bpmn') {
    return null;
  }

  const model = bifrost.editors.getEditorDocumentModelIfPresent<BpmnDocumentModel>(doc);
  return model?.modelerAdapter?.getModelerComponentByName<SanitizerBridgeApi>('sanitizerBridge') ?? null;
}

function getModelerServices(bifrost: Bifrost): { commandStack: any; definitions: any; elementRegistry: any } | null {
  const doc = bifrost.editors.getFocusedEditorDocument();
  if (!doc || doc.documentType !== 'bpmn') {
    return null;
  }

  const model = bifrost.editors.getEditorDocumentModelIfPresent<BpmnDocumentModel>(doc);
  if (!model?.modelerAdapter) {
    return null;
  }

  const adapter = model.modelerAdapter;
  const commandStack = adapter.getModelerComponentByName<any>('commandStack');
  const canvas = adapter.getModelerComponentByName<any>('canvas');
  const elementRegistry = adapter.getModelerComponentByName<any>('elementRegistry');

  if (!commandStack || !canvas) {
    return null;
  }

  const rootShape = canvas.getRootElement();
  let bo = rootShape?.businessObject;
  while (bo != null && bo.$type !== 'bpmn:Definitions') {
    bo = bo.$parent;
  }

  return bo ? { commandStack, definitions: bo, elementRegistry } : null;
}

export function initializeSanitizerCommands(bifrost: Bifrost): void {
  const isBpmnFocused = () => bifrost.editors.getFocusedEditorDocument()?.documentType === 'bpmn';

  const showInInspector = async () => {
    bifrost.panes.setVisibilityOfPaneAreaByPaneId('inspectors/editor_document_inspector', true);

    const treeview = await bifrost.views.waitForAndGetById('editorInspector');
    await treeview.waitForAndSelectEntriesByMetadataFilter((metadata) => metadata.action === 'show-sanitizer');

    const selectedEntry = document.querySelector(
      treeview.domSelector + ' .treeview__entry--selected',
    ) as HTMLElement | null;
    selectedEntry?.click();
  };

  bifrost.commands.register('bpmn.sanitizer.showInInspector', showInInspector, {
    visibleInSearch: true,
    description: ['BPMN: Show sanitizer report', 'BPMN: Show structural issues'],
    enabledWhen: isBpmnFocused,
  });

  const fixAll = async () => {
    const bridge = getSanitizerBridge(bifrost);
    if (!bridge) {
      return;
    }

    const findings = bridge.getFindings();
    if (findings.length === 0) {
      return;
    }

    const result = await bifrost.dialog.open({
      title: 'Fix Structural Issues',
      content: [
        {
          type: 'text',
          text: `This will fix ${findings.length} structural issue${findings.length > 1 ? 's' : ''} in the diagram XML. This action can be undone with Ctrl+Z. Proceed?`,
        },
      ],
      actions: [
        { label: 'Cancel', response: 'cancel', cancel: true },
        { label: 'Fix All', response: 'fix', default: true },
      ],
    });

    if (result?.wasCancelled || result?.response !== 'fix') {
      return;
    }

    const services = getModelerServices(bifrost);
    if (!services) {
      return;
    }

    const danglingRefIds = findings
      .filter((issue) => issue.category === 'dangling-reference')
      .map((issue) => issue.elementId);

    const nonDanglingFindings = findings.filter((issue) => issue.category !== 'dangling-reference');
    if (nonDanglingFindings.length > 0) {
      const batch = buildSanitizerFixCommands(nonDanglingFindings, services.definitions, services.elementRegistry);
      services.commandStack.execute(batch.cmd, batch.context);
    }

    if (danglingRefIds.length > 0) {
      bridge.dismissDanglingRefWarnings(danglingRefIds);
    }
  };

  const fixAllEnabled = () => {
    if (!isBpmnFocused()) {
      return false;
    }
    const bridge = getSanitizerBridge(bifrost);
    return bridge != null && bridge.getFindingsCount() > 0;
  };

  bifrost.commands.register('bpmn.sanitizer.fixAll', fixAll, {
    visibleInSearch: true,
    description: ['BPMN: Fix all structural issues', 'BPMN: Sanitize diagram'],
    enabledWhen: fixAllEnabled,
  });

  bifrost.commands.register(
    'bpmn.sanitizer.fixIssue',
    (issue: SanitizableIssue) => {
      if (issue.category === 'dangling-reference') {
        const bridge = getSanitizerBridge(bifrost);
        bridge?.dismissDanglingRefWarnings([issue.elementId]);
        return;
      }

      const services = getModelerServices(bifrost);
      if (!services) {
        return;
      }

      const batch = buildSanitizerFixCommands([issue], services.definitions, services.elementRegistry);
      services.commandStack.execute(batch.cmd, batch.context);
    },
    { enabledWhen: isBpmnFocused },
  );
}

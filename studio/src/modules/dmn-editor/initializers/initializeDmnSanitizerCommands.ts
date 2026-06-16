import type { Bifrost } from '#bifrost/Bifrost';

import type { DmnDocumentModel } from '@evil/bifrost_fw_sdk/types/DmnDocumentModel';

import { buildDmnSanitizerFixCommands } from '../../dmn-core/sanitizer/DmnSanitizerFixer';
import type { DmnSanitizerBridgeApi } from '../../dmn-core/sanitizer/SanitizerBridge';
import type { DmnSanitizableIssue } from '../../dmn-core/sanitizer/sanitizerTypes';

function getSanitizerBridge(bifrost: Bifrost): DmnSanitizerBridgeApi | null {
  const doc = bifrost.editors.getFocusedEditorDocument();
  if (!doc || doc.documentType !== 'dmn') {
    return null;
  }

  const model = bifrost.editors.getEditorDocumentModelIfPresent<DmnDocumentModel>(doc);
  return model?.modelerAdapter?.getDmnSanitizerBridge() ?? null;
}

function getModelerServices(bifrost: Bifrost): { commandStack: any; definitions: any; elementRegistry: any } | null {
  const doc = bifrost.editors.getFocusedEditorDocument();
  if (!doc || doc.documentType !== 'dmn') {
    return null;
  }

  const model = bifrost.editors.getEditorDocumentModelIfPresent<DmnDocumentModel>(doc);
  if (!model?.modelerAdapter) {
    return null;
  }

  const adapter = model.modelerAdapter;
  if (!adapter.isDrdActive()) {
    return null;
  }

  try {
    const commandStack = adapter.getDrdCommandStack();
    const canvas = adapter.getDrdCanvas();
    const elementRegistry = adapter.getDrdElementRegistry();

    if (!commandStack || !canvas) {
      return null;
    }

    const rootShape = canvas.getRootElement();
    let bo = (rootShape as any)?.businessObject;
    while (bo != null && bo.$type !== 'dmn:Definitions') {
      bo = bo.$parent;
    }

    return bo ? { commandStack, definitions: bo, elementRegistry } : null;
  } catch {
    return null;
  }
}

function notifyIfNotDrdActive(bifrost: Bifrost): void {
  const doc = bifrost.editors.getFocusedEditorDocument();
  if (doc?.documentType === 'dmn') {
    const model = bifrost.editors.getEditorDocumentModelIfPresent<DmnDocumentModel>(doc);
    if (model?.modelerAdapter && !model.modelerAdapter.isDrdActive()) {
      bifrost.notifications.open({
        type: 'info',
        content: 'Switch to the DRD view to fix structural issues.',
      });
    }
  }
}

export function initializeDmnSanitizerCommands(bifrost: Bifrost): void {
  const isDmnFocused = () => bifrost.editors.getFocusedEditorDocument()?.documentType === 'dmn';

  const showInInspector = async () => {
    bifrost.panes.setVisibilityOfPaneAreaByPaneId('inspectors/editor_document_inspector', true);

    const treeview = await bifrost.views.waitForAndGetById('dmnEditorInspector');
    await treeview.waitForAndSelectEntriesByMetadataFilter((metadata) => metadata.action === 'show-sanitizer');

    const selectedEntry = document.querySelector(
      treeview.domSelector + ' .treeview__entry--selected',
    ) as HTMLElement | null;
    selectedEntry?.click();
  };

  bifrost.commands.register('dmn.sanitizer.showInInspector', showInInspector, {
    visibleInSearch: true,
    description: ['DMN: Show sanitizer report', 'DMN: Show structural issues'],
    enabledWhen: isDmnFocused,
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
          text: `This will fix ${findings.length} structural issue${findings.length > 1 ? 's' : ''} in the DMN XML. This action can be undone with Ctrl+Z. Proceed?`,
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
      notifyIfNotDrdActive(bifrost);
      return;
    }

    const danglingRefIds = findings
      .filter((issue) => issue.category === 'dangling-reference')
      .map((issue) => issue.elementId);

    const nonDanglingFindings = findings.filter((issue) => issue.category !== 'dangling-reference');
    if (nonDanglingFindings.length > 0) {
      const batch = buildDmnSanitizerFixCommands(nonDanglingFindings, services.definitions, services.elementRegistry);
      services.commandStack.execute(batch.cmd, batch.context);
    }

    if (danglingRefIds.length > 0) {
      bridge.dismissDanglingRefWarnings(danglingRefIds);
    }
  };

  const fixAllEnabled = () => {
    if (!isDmnFocused()) {
      return false;
    }
    const bridge = getSanitizerBridge(bifrost);
    return bridge != null && bridge.getFindingsCount() > 0;
  };

  bifrost.commands.register('dmn.sanitizer.fixAll', fixAll, {
    visibleInSearch: true,
    description: ['DMN: Fix all structural issues', 'DMN: Sanitize diagram'],
    enabledWhen: fixAllEnabled,
  });

  bifrost.commands.register(
    'dmn.sanitizer.fixIssue',
    (issue: DmnSanitizableIssue) => {
      if (issue.category === 'dangling-reference') {
        const bridge = getSanitizerBridge(bifrost);
        bridge?.dismissDanglingRefWarnings([issue.elementId]);
        return;
      }

      const services = getModelerServices(bifrost);
      if (!services) {
        notifyIfNotDrdActive(bifrost);
        return;
      }

      const batch = buildDmnSanitizerFixCommands([issue], services.definitions, services.elementRegistry);
      services.commandStack.execute(batch.cmd, batch.context);
    },
    { enabledWhen: isDmnFocused },
  );
}

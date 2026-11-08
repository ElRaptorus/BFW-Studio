import type { Bifrost } from '#bifrost/Bifrost';
import type { EditorDocument } from '#bifrost/contracts/EditorTypes';

import InteractionsDocumentModel, {
  INTERACTIONS_HIDE_SETTING,
  INTERACTIONS_LAYOUT_SETTING,
  readInteractionsSetting,
  writeInteractionsSetting,
} from './InteractionsDocumentModel';
import { registerInteractionsExportCommands } from './exportCommands';

function getFocusedInteractions(bifrost: Bifrost): InteractionsDocumentModel | null {
  const editorDocument = bifrost.editors.getFocusedEditorDocument();
  const model = editorDocument == null ? null : bifrost.editors.getEditorDocumentModelIfPresent(editorDocument);
  return model instanceof InteractionsDocumentModel ? model : null;
}

function hasFocusedInteractionsWithSolution(bifrost: Bifrost): boolean {
  return bifrost.solution.getSolution() != null && getFocusedInteractions(bifrost) != null;
}

function toggleSetting(bifrost: Bifrost, settingName: string): void {
  if (getFocusedInteractions(bifrost) == null) {
    return;
  }
  writeInteractionsSetting(bifrost, settingName, readInteractionsSetting(bifrost, settingName) !== true);
}

export function registerInteractionsCommands(bifrost: Bifrost): void {
  bifrost.commands.register(
    'bpmn.interactions.generate',
    async () => {
      await getFocusedInteractions(bifrost)?.generate();
    },
    {
      visibleInSearch: true,
      description: [
        'Interactions: Generate or regenerate the diagram',
        'Builds the interaction graph from the selected processes',
      ],
      enabledWhen: () => {
        const model = getFocusedInteractions(bifrost);
        return (
          bifrost.solution.getSolution() != null &&
          model != null &&
          !model.isGenerating() &&
          model.getSelectedProcessReferences().length > 0
        );
      },
    },
  );

  bifrost.commands.register(
    'bpmn.interactions.toggleHideProcessesWithoutInteraction',
    () => toggleSetting(bifrost, INTERACTIONS_HIDE_SETTING),
    {
      visibleInSearch: true,
      description: [
        'Interactions: Toggle Hide processes without interaction',
        'Omit selected processes that have no line in the current view',
      ],
      enabledWhen: () => hasFocusedInteractionsWithSolution(bifrost),
    },
  );

  bifrost.commands.register(
    'bpmn.interactions.setLayout',
    (mode: unknown) => {
      if (getFocusedInteractions(bifrost) == null || (mode !== 'direct' && mode !== 'stations')) {
        return;
      }
      writeInteractionsSetting(bifrost, INTERACTIONS_LAYOUT_SETTING, mode);
    },
    {
      description: ['Interactions: Set layout mode', 'Switch between Direct and Stations line routing'],
      enabledWhen: () => hasFocusedInteractionsWithSolution(bifrost),
    },
  );

  bifrost.commands.register(
    'bpmn.interactions.toggleFocusMode',
    () => getFocusedInteractions(bifrost)?.toggleFocusMode(),
    {
      visibleInSearch: true,
      description: ['Interactions: Toggle Focus Mode', 'Dim unrelated elements on the diagram'],
      enabledWhen: () => getFocusedInteractions(bifrost)?.hasGeneratedDiagram() === true,
    },
  );

  bifrost.commands.register('bpmn.interactions.find', () => getFocusedInteractions(bifrost)?.toggleSearch(), {
    visibleInSearch: true,
    description: ['Interactions: Find', 'Search processes, ports and stations on the diagram'],
    enabledWhen: () => getFocusedInteractions(bifrost)?.hasGeneratedDiagram() === true,
  });

  bifrost.commands.register(
    'bpmn.interactions.openElement',
    (elementId?: string) => getFocusedInteractions(bifrost)?.openElement(elementId),
    {
      visibleInSearch: true,
      description: ['Interactions: Open in Designer', 'Open the selected process or port in the BPMN editor'],
      enabledWhen: (elementId?: string) => getFocusedInteractions(bifrost)?.resolveBpmnTarget(elementId) != null,
    },
  );

  bifrost.commands.register(
    'bpmn.interactions.openElementInTextEditor',
    async (elementId?: string) => {
      await getFocusedInteractions(bifrost)?.openElementInTextEditor(elementId);
    },
    {
      visibleInSearch: true,
      description: ['Interactions: Open element in text editor', 'Open the BPMN XML at the selected element'],
      enabledWhen: (elementId?: string) => {
        const target = getFocusedInteractions(bifrost)?.resolveBpmnTarget(elementId);
        return target != null && bifrost.commands.isCommandEnabled('std.shell.openDocumentInTextEditor', [target.uri]);
      },
    },
  );

  bifrost.commands.register(
    'bpmn.interactions.addPartnersOutsideView',
    (portId?: string) => getFocusedInteractions(bifrost)?.addPartnersOutsideView(portId),
    {
      visibleInSearch: true,
      description: [
        'Interactions: Add partners outside the view',
        'Add every partner process that is outside the current selection',
      ],
      enabledWhen: (portId?: string) => {
        const port = getFocusedInteractions(bifrost)?.resolveCanvasElement(portId);
        return port != null && 'partnersOutsideView' in port && port.partnersOutsideView.length > 0;
      },
    },
  );

  bifrost.commands.register(
    'bpmn.interactions.addAllPartnersOutsideView',
    async () => {
      await getFocusedInteractions(bifrost)?.addAllPartnersOutsideViewAndGenerate();
    },
    {
      visibleInSearch: true,
      description: [
        'Interactions: Add all partners outside the view',
        'Add every partner process outside the view for any port, then regenerate',
      ],
      enabledWhen: () => {
        const summary = getFocusedInteractions(bifrost)?.getDiagramSummary();
        return summary != null && summary.portsWithPartnersOutsideView > 0;
      },
    },
  );

  bifrost.commands.register(
    'bpmn.interactions.revealNextUnconnectedPort',
    () => getFocusedInteractions(bifrost)?.revealNextUnconnectedPort(),
    {
      visibleInSearch: true,
      description: [
        'Interactions: Reveal next unconnected port',
        'Select and scroll to the next port with no partner in the solution',
      ],
      enabledWhen: () => {
        const summary = getFocusedInteractions(bifrost)?.getDiagramSummary();
        return summary != null && summary.portsWithoutPartnerInSolution > 0;
      },
    },
  );

  bifrost.commands.register(
    'bpmn.interactions.copySelectedElementId',
    (elementId?: string) => getFocusedInteractions(bifrost)?.copySelectedElementId(elementId),
    {
      visibleInSearch: true,
      description: [
        'Interactions: Copy id',
        'Copy the BPMN id of the selected process or port, or the name of a line or station',
      ],
      enabledWhen: (elementId?: string) =>
        elementId != null || getFocusedInteractions(bifrost)?.getSelectedCanvasElementId() != null,
    },
  );

  registerInteractionsExportCommands(bifrost);

  const zoomActions = {
    zoomToViewport: (model: InteractionsDocumentModel) => model.zoomToViewport(),
    zoomToActualSize: (model: InteractionsDocumentModel) => model.zoomToActualSize(),
    zoomToSelectedElement: (model: InteractionsDocumentModel) => model.zoomToSelectedElement(),
  };
  const documentType = 'bpmn-interactions-map';
  for (const [name, zoom] of Object.entries(zoomActions)) {
    bifrost.commands.register(`std.editor.${name}.${documentType}`, async (editorDocument: EditorDocument) =>
      zoom(await bifrost.editors.getEditorDocumentModel<InteractionsDocumentModel>(editorDocument)),
    );
  }
}

/** Test-only commands for the integration suite (Phase 6). */
export function registerInteractionsTestCommands(bifrost: Bifrost): void {
  bifrost.commands.register(
    'bpmn.interactions.test.selectProcesses',
    (references: { uri: string; processId: string }[]) => {
      const model = getFocusedInteractions(bifrost);
      if (model == null) {
        return;
      }
      const currentSelection = model.getSelectedProcessReferences();
      model.setProcessesSelected(currentSelection, false);
      for (const reference of references) {
        model.setProcessSelected(reference, true);
      }
    },
  );

  bifrost.commands.register('bpmn.interactions.test.generate', async () => {
    await getFocusedInteractions(bifrost)?.generate();
  });

  bifrost.commands.register(
    'bpmn.interactions.test.getGraphSummary',
    () => getFocusedInteractions(bifrost)?.getDiagramSummary() ?? null,
  );

  bifrost.commands.register(
    'bpmn.interactions.test.isStale',
    () => getFocusedInteractions(bifrost)?.isStale() === true,
  );
}

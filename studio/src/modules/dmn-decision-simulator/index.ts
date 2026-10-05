import type { Bifrost } from '#bifrost/Bifrost';
import type DmnDocumentModel from '#modules/dmn-editor/DmnDocumentModel';

import { DmnSimulatorBridge } from './DmnSimulatorBridge';
import { DmnSimulatorPaletteProvider } from './DmnSimulatorPaletteProvider';
import './styles/dmn-simulator.scss';

type SimulatorDocument = {
  model: DmnDocumentModel;
  adapter: DmnDocumentModel['modelerAdapter'];
  /** The diagram-js `DmnSimulatorBridge` service of the document's DRD canvas. */
  bridge: any;
};

/**
 * Finds the DRD document the simulator command applies to: the document that owns the given bridge (palette click),
 * otherwise the focused document. Returns `null` unless that document currently shows its DRD.
 */
function resolveSimulatorDocument(bifrost: Bifrost, bridge?: unknown): SimulatorDocument | null {
  const candidates =
    bridge == null
      ? [bifrost.editors.getFocusedEditorDocument()]
      : bifrost.editors.getOpenEditorDocuments().filter((document) => document.documentType === 'dmn');
  for (const editorDocument of candidates) {
    if (editorDocument == null || editorDocument.documentType !== 'dmn') {
      continue;
    }
    const model = bifrost.editors.getEditorDocumentModelIfPresent<DmnDocumentModel>(editorDocument);
    const adapter = model?.modelerAdapter;
    if (model == null || adapter == null || !adapter.isDrdActive()) {
      continue;
    }
    const documentBridge = adapter.getDrdViewer()?.get('dmnSimulatorBridge');
    if (documentBridge != null && (bridge == null || documentBridge === bridge)) {
      return { model, adapter, bridge: documentBridge };
    }
  }
  return null;
}

export function onLoad(bifrost: Bifrost): void {
  bifrost.helpTexts.registerHelpText('dmn/simulator', require('./texts/dmn-simulator.md'));

  bifrost.commands.executeCommand('dmn.modeler.registerModule', [
    {
      __init__: ['dmnSimulatorBridge', 'dmnSimulatorPaletteProvider'],
      dmnSimulatorBridge: ['type', DmnSimulatorBridge],
      dmnSimulatorPaletteProvider: ['type', DmnSimulatorPaletteProvider],
      dmnSimulatorHost: ['value', { bifrost }],
    },
  ]);

  bifrost.commands.register(
    'dmn.simulator.toggle',
    (bridge?: unknown) => {
      const simulatorDocument = resolveSimulatorDocument(bifrost, bridge);
      simulatorDocument?.bridge.toggle({
        uri: simulatorDocument.model.getUri(),
        bifrost,
        adapter: simulatorDocument.adapter,
      });
    },
    {
      visibleInSearch: true,
      description: ['Editor: Toggle Decision Simulator', 'Decision Simulator'],
      enabledWhen: (bridge?: unknown) => resolveSimulatorDocument(bifrost, bridge) != null,
    },
  );
}

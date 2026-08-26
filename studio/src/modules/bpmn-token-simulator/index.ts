import type { Bifrost } from '#bifrost/Bifrost';
import type BpmnDocumentModel from '#modules/bpmn-editor/BpmnDocumentModel';

import { TokenSimPaletteProvider } from './TokenSimPaletteProvider';
import { TokenSimulationBridge } from './TokenSimulationBridge';
import './token-simulation.scss';

export interface TokenSimSettingsAccessor {
  get(key: string): any;
  set(key: string, value: any): void;
}

export function onLoad(bifrost: Bifrost): void {
  bifrost.settings.register({
    'tokenSimulator.toolbar.mode': {
      type: 'string',
      label: 'Simulation Mode',
      description: 'Default simulation mode when the token simulator is activated.',
      default: 'auto',
      enum: ['auto', 'step'],
      enumLabels: { auto: 'Auto', step: 'Step' },
      enumDescriptions: [
        'Tokens flow automatically with configurable speed',
        'Tokens pause at each activity; click to advance',
      ],
      category: 'Token Simulator',
    },
    'tokenSimulator.toolbar.speed': {
      type: 'number',
      label: 'Simulation Speed',
      description: 'Default speed multiplier. 1.0 is normal speed.',
      default: 1.0,
      minimum: 0.1,
      maximum: 5.0,
      category: 'Token Simulator',
    },
    'tokenSimulator.toolbar.showCounters': {
      type: 'boolean',
      label: 'Show Token Counters',
      description: 'Show visit-count badges on elements when the simulator is active.',
      default: false,
      category: 'Token Simulator',
    },
    'tokenSimulator.toolbar.showLog': {
      type: 'boolean',
      label: 'Show Simulation Log',
      description: 'Show the simulation event log panel beneath the toolbar.',
      default: false,
      category: 'Token Simulator',
    },
  });

  const settingsAccessor: TokenSimSettingsAccessor = {
    get: (key: string) => bifrost.settings.get(key),
    set: (key: string, value: any) => bifrost.settings.set(key, value),
  };

  bifrost.commands.executeCommand('bpmn.modeler.registerModule', [
    {
      __init__: ['tokenSimulationBridge', 'tokenSimPaletteProvider'],
      tokenSimulationBridge: ['type', TokenSimulationBridge],
      tokenSimPaletteProvider: ['type', TokenSimPaletteProvider],
      tokenSimSettings: ['value', settingsAccessor],
    },
  ]);

  bifrost.commands.register(
    'bpmn.tokenSimulation.toggle',
    async () => {
      const editorDocument = bifrost.editors.getFocusedEditorDocument();
      if (!editorDocument) {
        return;
      }
      const model = bifrost.editors.getEditorDocumentModelIfPresent<BpmnDocumentModel>(editorDocument);
      if (!model?.modelerAdapter) {
        return;
      }
      const bridge = model.modelerAdapter.getModelerComponentByName<any>('tokenSimulationBridge');
      bridge?.toggle();
    },
    {
      visibleInSearch: true,
      description: ['Editor: Toggle Token Simulation', 'Token Simulation'],
      enabledWhen: () => bifrost.editors.getFocusedEditorDocument()?.documentType === 'bpmn',
    },
  );
}

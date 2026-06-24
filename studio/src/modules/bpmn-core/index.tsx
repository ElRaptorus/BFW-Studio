import type { Bifrost } from '#bifrost/Bifrost';

import { bpmnModelerModuleRegistry } from './BpmnModelerModuleRegistry';
import PluginContextPadProviderModule from './bpmn-js/Provider/PluginContextPadProvider';
import PluginPaletteProviderModule from './bpmn-js/Provider/PluginPaletteProvider';
import './sanitizer/sanitizer.scss';

export function onLoad(bifrost: Bifrost): void {
  bifrost.icons.registerIcons({
    'bpmn/element/overlay/preScript': 'bpmn-icon-script',
    'bpmn/element/overlay/postScript': 'bpmn-icon-script',
    'bpmn/element/overlay/documentation': 'ph ph-file-text',
    'bpmn/element/overlay/processNotExecutable': 'ph-fill ph-warning ph-2x',
    'bpmn/element/overlay/singletonProcess': 'ph-duotone ph-arrow-circle-up',
  });

  bifrost.commands.register('bpmn.modeler.registerModule', (module: any) => {
    bpmnModelerModuleRegistry.register(module);
  });

  bpmnModelerModuleRegistry.register(PluginPaletteProviderModule);
  bpmnModelerModuleRegistry.register(PluginContextPadProviderModule);
}

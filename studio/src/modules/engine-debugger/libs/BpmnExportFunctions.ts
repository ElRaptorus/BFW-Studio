import { assertNotNull } from '#bifrost/common/AssertionFunctions';
import type { DialogManager } from '#bifrost/common/DialogManager';
import type { ImageFormat } from '#modules/bpmn-core/ImageExportFunctions';
import { getSvgSize, renderElementToImage, runWithExportHint } from '#modules/bpmn-core/ImageExportFunctions';
import BpmnViewer from 'bpmn-js/lib/Viewer';

import type EngineBpmnDebuggerEditorDocumentModel from '../EngineBpmnDebuggerEditorDocumentModel';

const PSEUDO_DIV_WIDTH = 1920;
const PSEUDO_DIV_HEIGHT = 1080;

export async function renderToImage(
  model: EngineBpmnDebuggerEditorDocumentModel,
  format: ImageFormat,
  dialog?: DialogManager,
): Promise<Buffer> {
  assertNotNull(dialog, 'dialog');

  return runWithExportHint(dialog, async () => renderWithOverlays(model, format));
}

async function renderWithOverlays(model: EngineBpmnDebuggerEditorDocumentModel, format: ImageFormat): Promise<Buffer> {
  assertNotNull(model.processInstance, 'model.processInstance');

  const pseudoInvisibleDiv = createPseudoInvisibleDiv();
  const { bpmnViewerComponentAdapter } = model;
  assertNotNull(bpmnViewerComponentAdapter, 'model.bpmnViewerComponentAdapter');
  const debuggerBjsContainer = (bpmnViewerComponentAdapter.getModeler() as unknown as { _container: HTMLElement })
    ._container;
  const debuggerContainerParent = debuggerBjsContainer.parentElement as HTMLElement;
  debuggerContainerParent.appendChild(pseudoInvisibleDiv);

  const viewer = new BpmnViewer({ container: pseudoInvisibleDiv }) as any;
  try {
    await viewer.importXML(model.processInstance?.xml ?? '');

    const { svg } = await viewer.saveSVG();
    const { svgHeight, svgWidth } = getSvgSize(svg);
    pseudoInvisibleDiv.style.width = `${svgWidth}px`;
    pseudoInvisibleDiv.style.height = `${svgHeight}px`;
    viewer.get('canvas').resized();

    const bjsContainer = (viewer as any)._container;
    const bjsPoweredBy = bjsContainer?.querySelector('.bjs-powered-by');

    if (bjsPoweredBy) {
      bjsContainer?.removeChild(bjsPoweredBy);
    }

    viewer.get('canvas').zoom('fit-viewport');

    const debuggerOverlays = model.bpmnViewerComponentAdapter?.getOverlays();
    const overlaysToTransfer = Object.values((debuggerOverlays as any)._overlays).map((overlay: any) => {
      return {
        elementId: overlay.element.id,
        html: overlay.htmlContainer.innerHTML,
        position: overlay.position,
      };
    });

    const pseudoOverlays = viewer.get('overlays');
    overlaysToTransfer.forEach((overlay) => {
      pseudoOverlays.add(overlay.elementId, {
        position: overlay.position,
        html: overlay.html,
      });
    });

    pseudoOverlays.show();

    await document.fonts.ready;

    return await renderElementToImage(pseudoInvisibleDiv, format, svgWidth, svgHeight);
  } finally {
    viewer.destroy();
    debuggerContainerParent.removeChild(pseudoInvisibleDiv);
  }
}

function createPseudoInvisibleDiv(): HTMLDivElement {
  const pseudoInvisibleDiv = document.createElement('div');
  pseudoInvisibleDiv.style.position = 'absolute';
  pseudoInvisibleDiv.style.left = '-10000px';
  pseudoInvisibleDiv.style.width = `${PSEUDO_DIV_WIDTH}px`;
  pseudoInvisibleDiv.style.height = `${PSEUDO_DIV_HEIGHT}px`;

  return pseudoInvisibleDiv;
}

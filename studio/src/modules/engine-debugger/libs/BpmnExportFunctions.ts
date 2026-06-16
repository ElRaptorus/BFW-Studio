import type { DialogManager } from '#bifrost/common/DialogManager';
import { convertCanvasToImageBuffer, getSvgSize } from '#modules/bpmn-core/SvgExportFunctions';
import BpmnViewer from 'bpmn-js/lib/Viewer';
import html2canvas from 'html2canvas';

import type { DialogOptions, DialogValidationResult } from '@evil/bifrost_fw_sdk';
import { assertNotNull } from '@evil/bifrost_fw_sdk';

import type EngineBpmnDebuggerEditorDocumentModel from '../EngineBpmnDebuggerEditorDocumentModel';

const PSEUDO_DIV_WIDTH = 1920;
const PSEUDO_DIV_HEIGHT = 1080;

export async function renderToPng(
  model: EngineBpmnDebuggerEditorDocumentModel,
  dialog?: DialogManager,
): Promise<Buffer> {
  assertNotNull(dialog, 'dialog');
  const dialogOptions: DialogOptions = {
    title: 'Exporting Process Instance to PNG',
    content: [
      {
        type: 'text',
        text: 'This may take a while, please be patient.',
      },
    ],
    actions: [],
  };

  let done = false;
  dialog.open(dialogOptions, async (): Promise<DialogValidationResult> => {
    if (done) {
      return { closeDialog: true };
    }

    return {
      closeDialog: false,
      validationErrors: [],
    };
  });

  const canvas = await generateCanvasWithOverlays(model);

  const buffer = convertCanvasToImageBuffer(canvas, 'image/png');

  done = true;

  if (dialog.isActive()) {
    dialog.close();
  }

  return buffer;
}

export async function renderToSvg(model: EngineBpmnDebuggerEditorDocumentModel): Promise<string> {
  assertNotNull(model.processInstance, 'model.processInstance');
  return getSvgByXml(model.processInstance?.xml ?? '');
}

async function getSvgByXml(xml: string): Promise<string> {
  const pseudoInvisibleDiv = createPseudoInvisibleDiv();
  document.body.appendChild(pseudoInvisibleDiv);

  const viewer = new BpmnViewer({ container: pseudoInvisibleDiv });
  await viewer.importXML(xml);
  const { svg } = await viewer.saveSVG();

  document.body.removeChild(pseudoInvisibleDiv);

  return svg;
}

async function generateCanvasWithOverlays(model: EngineBpmnDebuggerEditorDocumentModel): Promise<HTMLCanvasElement> {
  assertNotNull(model.processInstance, 'model.processInstance');

  const svg = await getSvgByXml(model.processInstance?.xml ?? '');
  const { svgHeight, svgWidth } = getSvgSize(svg);

  const pseudoInvisibleDiv = createPseudoInvisibleDiv(svgWidth, svgHeight);
  const debuggerBjsContainer = (
    model.bpmnViewerComponentAdapter?.getModeler() as unknown as { _container: HTMLElement }
  )._container;
  (debuggerBjsContainer.parentElement as HTMLElement).appendChild(pseudoInvisibleDiv);

  const viewer = new BpmnViewer({ container: pseudoInvisibleDiv }) as any;
  await viewer.importXML(model.processInstance?.xml ?? '');

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

  await new Promise((resolve) => setTimeout(resolve, 500));

  const canvas = await html2canvas(pseudoInvisibleDiv, {
    logging: false,
  });

  (debuggerBjsContainer.parentElement as HTMLElement).removeChild(pseudoInvisibleDiv);

  return canvas;
}

function createPseudoInvisibleDiv(
  width: number = PSEUDO_DIV_WIDTH,
  height: number = PSEUDO_DIV_HEIGHT,
): HTMLDivElement {
  const pseudoInvisibleDiv = document.createElement('div');
  pseudoInvisibleDiv.style.position = 'absolute';
  pseudoInvisibleDiv.style.left = '-10000px';
  pseudoInvisibleDiv.style.width = `${width}px`;
  pseudoInvisibleDiv.style.height = `${height}px`;

  return pseudoInvisibleDiv;
}

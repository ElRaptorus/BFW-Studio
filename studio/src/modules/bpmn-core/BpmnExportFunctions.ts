import BpmnViewer from 'bpmn-js/lib/Viewer';

import { convertSvgToImageBuffer } from './SvgExportFunctions';

const PSEUDO_DIV_WIDTH = 1920;
const PSEUDO_DIV_HEIGHT = 1080;

export async function renderBpmnToPng(xml: string): Promise<Buffer> {
  const svg = await renderBpmnToSvg(xml);

  return convertSvgToImageBuffer(svg, 'image/png');
}

export async function renderBpmnToSvg(xml: string): Promise<string> {
  const pseudoInvisibleDiv = createPseudoInvisibleDiv();

  const viewer = new BpmnViewer({ container: pseudoInvisibleDiv });
  await viewer.importXML(xml);
  const { svg } = await viewer.saveSVG();

  document.body.removeChild(pseudoInvisibleDiv);

  return svg;
}

function createPseudoInvisibleDiv(): HTMLDivElement {
  const pseudoInvisibleDiv = document.createElement('div');
  pseudoInvisibleDiv.style.position = 'absolute';
  pseudoInvisibleDiv.style.left = '-10000px';
  pseudoInvisibleDiv.style.width = `${PSEUDO_DIV_WIDTH}px`;
  pseudoInvisibleDiv.style.height = `${PSEUDO_DIV_HEIGHT}px`;

  document.body.appendChild(pseudoInvisibleDiv);

  return pseudoInvisibleDiv;
}

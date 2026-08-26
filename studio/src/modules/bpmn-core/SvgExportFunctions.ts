import { assertNotNull } from '#bifrost/common/AssertionFunctions';

export async function convertSvgToImageBuffer(svg: string, mimeType: string): Promise<Buffer> {
  const canvas = createCanvasForSvg(svg);

  await drawSvgIntoCanvas(svg, canvas);

  const dataUri = canvas.toDataURL(mimeType);
  const buffer = getBufferFromDataUri(dataUri);

  return buffer;
}

export function convertCanvasToImageBuffer(canvas: HTMLCanvasElement, mimeType: string): Buffer {
  const dataUri = canvas.toDataURL(mimeType);
  const buffer = getBufferFromDataUri(dataUri);

  return buffer;
}

export function getSvgSize(svg: string): any {
  const svgWidthMatches = svg.match(/<svg[^>]*width\s*=\s*"?(\d+)"?[^>]*>/);
  assertNotNull(svgWidthMatches, 'svgWidthMatches');
  const svgWidth = parseInt(svgWidthMatches[1]);

  const svgHeightMatches = svg.match(/<svg[^>]*height\s*=\s*"?(\d+)"?[^>]*>/);
  assertNotNull(svgHeightMatches, 'svgHeightMatches');
  const svgHeight = parseInt(svgHeightMatches[1]);

  return { svgHeight, svgWidth };
}

export function createCanvasForSvg(svg: string): HTMLCanvasElement {
  const canvas = document.createElement('canvas');

  const { svgWidth, svgHeight } = getSvgSize(svg);

  const targetDPI = 300;
  const dinA4DiagonalSizeInch = 14.17;
  const pixelRatio = calculatePixelRatio(svgWidth, svgHeight, targetDPI, dinA4DiagonalSizeInch);

  canvas.width = svgWidth * pixelRatio;
  canvas.height = svgHeight * pixelRatio;

  return canvas;
}

function calculatePixelRatio(width: number, height: number, dpi: number, diagonalSize: number): number {
  const square = (num: number): number => num * num;

  const svgWidthSquared: number = square(width);
  const svgHeightSquared: number = square(height);

  const diagonalResolution: number = Math.sqrt(svgWidthSquared + svgHeightSquared);

  const originalDPI: number = diagonalResolution / diagonalSize;
  const pixelRatio: number = dpi / originalDPI;

  return pixelRatio;
}

function getBufferFromDataUri(dataURI: string): Buffer {
  const firstComma = dataURI.indexOf(',');
  const newData = dataURI.slice(firstComma + 1);

  return Buffer.from(newData, 'base64');
}

async function drawSvgIntoCanvas(svg: string, canvas: HTMLCanvasElement): Promise<void> {
  const context = canvas.getContext('2d');
  assertNotNull(context, 'context');
  context.fillStyle = 'white';
  context.fillRect(0, 0, canvas.width, canvas.height);

  const imageElement = document.createElement('img');
  const encodedSVG = btoa(unescape(encodeURIComponent(svg)));
  const svgDataUri = `data:image/svg+xml;base64, ${encodedSVG}`;

  imageElement.setAttribute('src', svgDataUri);

  return new Promise((resolve, reject): void => {
    imageElement.onload = (): void => {
      context.drawImage(imageElement, 0, 0, canvas.width, canvas.height);

      resolve();
    };

    imageElement.onerror = (errorEvent) => reject(errorEvent);
  });
}

import { assertNotNull } from '#bifrost/common/AssertionFunctions';
import type { DialogManager } from '#bifrost/common/DialogManager';
import type { DialogValidationResult } from '#bifrost/contracts/DialogTypes';
import BpmnViewer from 'bpmn-js/lib/Viewer';
import type Canvas from 'diagram-js/lib/core/Canvas';
import { domToBlob, domToSvg } from 'modern-screenshot';

export type ImageFormat = 'png' | 'jpeg' | 'webp' | 'svg';
type RasterImageFormat = Exclude<ImageFormat, 'svg'>;

export const IMAGE_SAVE_DIALOG_FILTERS = [
  { name: 'PNG image', extensions: ['png'] },
  { name: 'JPEG image', extensions: ['jpg', 'jpeg'] },
  { name: 'WebP image', extensions: ['webp'] },
  { name: 'SVG image', extensions: ['svg'] },
];

export const SUPPORTED_IMAGE_EXTENSIONS_TEXT = '.png, .jpg, .jpeg, .webp or .svg';

const IMAGE_FORMAT_BY_EXTENSION: Record<string, ImageFormat> = {
  png: 'png',
  jpg: 'jpeg',
  jpeg: 'jpeg',
  webp: 'webp',
  svg: 'svg',
};

const MIME_TYPE_BY_RASTER_FORMAT: Record<RasterImageFormat, string> = {
  png: 'image/png',
  jpeg: 'image/jpeg',
  webp: 'image/webp',
};

/** Sharp on high-DPI screens and in documents; larger scales make exports noticeably slow. */
const EXPORT_SCALE = 2;

const BACKGROUND_COLOR = '#ffffff';

const BPMN_VIEWER_WIDTH = 1920;
const BPMN_VIEWER_HEIGHT = 1080;

/**
 * Returns the image format for the extension of the given file name, or `null` when the
 * file name has no extension or one that cannot be exported.
 */
export function getImageFormatForFilename(filename: string): ImageFormat | null {
  const baseName = filename.split(/[/\\]/).pop() ?? '';
  const extensionStart = baseName.lastIndexOf('.');
  if (extensionStart <= 0) {
    return null;
  }

  const extension = baseName.slice(extensionStart + 1).toLowerCase();

  return IMAGE_FORMAT_BY_EXTENSION[extension] ?? null;
}

/**
 * Shows a non-dismissable "please be patient" dialog while `render` runs. Rendering blocks the
 * main thread, so it only starts once the dialog has been painted.
 */
export async function runWithExportHint<T>(dialog: DialogManager, render: () => Promise<T>): Promise<T> {
  let done = false;
  void dialog.open(
    {
      title: 'Exporting as image',
      content: [{ type: 'text', text: 'This may take a while, please be patient.' }],
      actions: [],
    },
    async (): Promise<DialogValidationResult> =>
      done ? { closeDialog: true } : { closeDialog: false, validationErrors: [] },
  );

  try {
    await waitForNextPaint();

    return await render();
  } finally {
    done = true;
    if (dialog.isActive()) {
      dialog.close();
    }
  }
}

/**
 * Renders BPMN XML with the library's default colours, independent of any open editor.
 * `rootElementId` selects the diagram plane, e.g. a drilled-down collapsed subprocess; without it, the main diagram.
 */
export async function renderBpmnToImage(
  xml: string,
  format: ImageFormat,
  rootElementId?: string | null,
): Promise<Buffer | string> {
  const svg = await renderBpmnToSvg(xml, rootElementId);
  if (format === 'svg') {
    return svg;
  }

  return renderSvgToRasterImage(svg, format);
}

/**
 * Renders an element (and everything inside it, including HTML overlays) into an image file.
 * The element may be positioned offscreen; its `left` offset is reset on the rendered copy.
 */
export async function renderElementToImage(
  element: HTMLElement,
  format: ImageFormat,
  width: number,
  height: number,
): Promise<Buffer> {
  const options = {
    width,
    height,
    scale: EXPORT_SCALE,
    backgroundColor: BACKGROUND_COLOR,
    style: { left: '0px' },
  };

  if (format === 'svg') {
    return getBufferFromDataUrl(await domToSvg(element, options));
  }

  const blob = await domToBlob(element, { ...options, type: MIME_TYPE_BY_RASTER_FORMAT[format] });

  return Buffer.from(await blob.arrayBuffer());
}

/** Rasterizes a self-contained SVG as an image, so decoding and encoding run off the main thread. */
export async function renderSvgToRasterImage(svg: string, format: RasterImageFormat): Promise<Buffer> {
  const { svgWidth, svgHeight } = getSvgSize(svg);

  const svgUrl = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }));
  try {
    const image = new Image();
    image.src = svgUrl;
    await image.decode();

    const canvas = document.createElement('canvas');
    canvas.width = svgWidth * EXPORT_SCALE;
    canvas.height = svgHeight * EXPORT_SCALE;
    const context = canvas.getContext('2d');
    assertNotNull(context, 'context');
    context.fillStyle = BACKGROUND_COLOR;
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(image, 0, 0, canvas.width, canvas.height);

    const blob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob(resolve, MIME_TYPE_BY_RASTER_FORMAT[format]);
    });
    assertNotNull(blob, 'blob');

    return Buffer.from(await blob.arrayBuffer());
  } finally {
    URL.revokeObjectURL(svgUrl);
  }
}

/**
 * The diagram viewers draw with theme CSS variables, which do not exist outside the Studio and
 * render as black. Exports use the neutral colours of bpmn-js and dmn-js instead.
 */
export function replaceThemeColorsInSvg(svg: string): string {
  return svg
    .replace(/var\(--color-(?:bpmn|dmn)-defaultFillColor\)/g, 'white')
    .replace(/var\(--color-(?:bpmn|dmn)-defaultStrokeColor\)/g, 'black');
}

export function getSvgSize(svg: string): { svgHeight: number; svgWidth: number } {
  const svgWidthMatches = svg.match(/<svg[^>]*width\s*=\s*"?(\d+)"?[^>]*>/);
  assertNotNull(svgWidthMatches, 'svgWidthMatches');
  const svgWidth = parseInt(svgWidthMatches[1]);

  const svgHeightMatches = svg.match(/<svg[^>]*height\s*=\s*"?(\d+)"?[^>]*>/);
  assertNotNull(svgHeightMatches, 'svgHeightMatches');
  const svgHeight = parseInt(svgHeightMatches[1]);

  return { svgHeight, svgWidth };
}

async function renderBpmnToSvg(xml: string, rootElementId?: string | null): Promise<string> {
  const offscreenDiv = document.createElement('div');
  offscreenDiv.style.position = 'absolute';
  offscreenDiv.style.left = '-10000px';
  offscreenDiv.style.width = `${BPMN_VIEWER_WIDTH}px`;
  offscreenDiv.style.height = `${BPMN_VIEWER_HEIGHT}px`;
  document.body.appendChild(offscreenDiv);

  const viewer = new BpmnViewer({ container: offscreenDiv });
  try {
    await viewer.importXML(xml);

    const canvas = viewer.get<Canvas>('canvas');
    const rootElement = canvas.getRootElements().find((root) => root.id === rootElementId);
    if (rootElement != null) {
      canvas.setRootElement(rootElement);
    }

    const { svg } = await viewer.saveSVG();

    return svg;
  } finally {
    viewer.destroy();
    document.body.removeChild(offscreenDiv);
  }
}

/** The first animation frame runs before the next paint, the second one after it. */
async function waitForNextPaint(): Promise<void> {
  await new Promise<void>((resolve) => {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => resolve());
    });
  });
}

function getBufferFromDataUrl(dataUrl: string): Buffer {
  const firstComma = dataUrl.indexOf(',');
  const header = dataUrl.slice(0, firstComma);
  const data = dataUrl.slice(firstComma + 1);

  if (header.includes(';base64')) {
    return Buffer.from(data, 'base64');
  }

  return Buffer.from(decodeURIComponent(data), 'utf8');
}

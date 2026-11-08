import PathMap from 'bpmn-js/lib/draw/PathMap';

import type { InteractionGraphPort } from '../buildInteractionGraph';

const SVG_NAMESPACE = 'http://www.w3.org/2000/svg';
const pathMap = new PathMap();

const DEFAULT_FILL = 'var(--color-bpmn-defaultFillColor)';
const DEFAULT_STROKE = 'var(--color-bpmn-defaultStrokeColor)';

/**
 * Glyphs are drawn at the size of a bpmn-js event and scaled to the port, so the radii, stroke widths, dash
 * patterns and marker paths below are the constants of `BpmnRenderer` unchanged.
 */
const REFERENCE_SIZE = 36;
const INNER_OUTER_DISTANCE = 3;
const NON_INTERRUPTING_DASH = '6';

function appendPath(
  parentGraphics: SVGElement,
  pathData: string,
  fill: string,
  stroke: string,
  strokeWidth: number,
): void {
  const path = document.createElementNS(SVG_NAMESPACE, 'path');
  path.setAttribute('d', pathData);
  path.setAttribute('fill', fill);
  path.setAttribute('stroke', stroke);
  path.setAttribute('stroke-width', String(strokeWidth));
  parentGraphics.appendChild(path);
}

function scaledPath(pathId: string, scale: number, position: { mx: number; my: number }): string {
  return pathMap.getScaledPath(pathId, {
    xScaleFactor: scale,
    yScaleFactor: scale,
    containerWidth: REFERENCE_SIZE,
    containerHeight: REFERENCE_SIZE,
    position,
  });
}

/** `offset` 0 is the event's outer ring; the inner ring of intermediate and boundary events is unfilled. */
function appendCircle(parentGraphics: SVGElement, offset: number, strokeWidth: number, dashed: boolean): void {
  const circleElement = document.createElementNS(SVG_NAMESPACE, 'circle');
  circleElement.setAttribute('cx', String(REFERENCE_SIZE / 2));
  circleElement.setAttribute('cy', String(REFERENCE_SIZE / 2));
  circleElement.setAttribute('r', String(REFERENCE_SIZE / 2 - offset));
  circleElement.setAttribute('fill', offset === 0 ? DEFAULT_FILL : 'none');
  circleElement.setAttribute('stroke', DEFAULT_STROKE);
  circleElement.setAttribute('stroke-width', String(strokeWidth));
  if (dashed) {
    circleElement.setAttribute('stroke-dasharray', NON_INTERRUPTING_DASH);
  }
  parentGraphics.appendChild(circleElement);
}

function isNonInterrupting(port: InteractionGraphPort): boolean {
  return port.interrupting === false && (port.position === 'start' || port.position === 'boundary');
}

/** Filled marker for throw, outlined for catch, as in BPMN. */
function drawKindMarker(parentGraphics: SVGElement, port: InteractionGraphPort): void {
  const isThrowing = port.direction === 'throw';
  if (port.kind === 'signal') {
    const pathData = scaledPath('EVENT_SIGNAL', 0.9, { mx: 0.5, my: 0.2 });
    appendPath(parentGraphics, pathData, isThrowing ? DEFAULT_STROKE : DEFAULT_FILL, DEFAULT_STROKE, 1);
    return;
  }
  const pathData = scaledPath('EVENT_MESSAGE', 0.9, { mx: 0.235, my: 0.315 });
  appendPath(
    parentGraphics,
    pathData,
    isThrowing ? DEFAULT_STROKE : DEFAULT_FILL,
    isThrowing ? DEFAULT_FILL : DEFAULT_STROKE,
    1,
  );
}

function drawEvent(parentGraphics: SVGElement, port: InteractionGraphPort): void {
  const dashed = isNonInterrupting(port);
  if (port.position === 'start') {
    appendCircle(parentGraphics, 0, 2, dashed);
  } else if (port.position === 'end') {
    appendCircle(parentGraphics, 0, 4, false);
  } else {
    appendCircle(parentGraphics, 0, 1.5, dashed);
    appendCircle(parentGraphics, INNER_OUTER_DISTANCE, 1.5, dashed);
  }
  drawKindMarker(parentGraphics, port);
}

/** Send and receive tasks: a small rounded task box with an envelope, filled for send. */
function drawTask(parentGraphics: SVGElement, port: InteractionGraphPort): void {
  const rect = document.createElementNS(SVG_NAMESPACE, 'rect');
  rect.setAttribute('x', '1');
  rect.setAttribute('y', '4');
  rect.setAttribute('width', String(REFERENCE_SIZE - 2));
  rect.setAttribute('height', String(REFERENCE_SIZE - 8));
  rect.setAttribute('rx', '5');
  rect.setAttribute('fill', DEFAULT_FILL);
  rect.setAttribute('stroke', DEFAULT_STROKE);
  rect.setAttribute('stroke-width', '2');
  parentGraphics.appendChild(rect);
  drawKindMarker(parentGraphics, port);
}

/** Draws the port marker for the BPMN event position, scaled into the `size` × `size` port shape. */
export function drawPortGlyph(parentGraphics: SVGElement, port: InteractionGraphPort, size: number): void {
  const glyph = document.createElementNS(SVG_NAMESPACE, 'g');
  glyph.setAttribute('transform', `scale(${size / REFERENCE_SIZE})`);
  if (port.position === 'sendTask' || port.position === 'receiveTask') {
    drawTask(glyph, port);
  } else {
    drawEvent(glyph, port);
  }
  parentGraphics.appendChild(glyph);
}

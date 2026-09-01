import { waitForAcceptance } from '#bifrost/common/WaitingFunctions';

export const DRD_CANVAS_LAYOUT_TIMEOUT_MS = 2000;
export const DRD_CANVAS_LAYOUT_RETRY_INTERVAL_MS = 16;

/**
 * dmn-js Manager.attachTo does not call canvas.resized() (unlike bpmn-js
 * BaseViewer.attachTo). importXML also happens while the Manager container is
 * still detached, so the DRD canvas caches 0×0 outer dimensions. One resized()
 * in the attach handler is not enough when the host flex layout has not flushed.
 *
 * Returns true when the DRD canvas reports a non-zero outer viewbox (or when
 * DRD is not the active view). Returns false if the timeout elapses.
 */
export async function waitForDrdCanvasLayout(
  isDrdActive: () => boolean,
  resizeActiveViewer: () => void,
  getOuterDimensions: () => { width: number; height: number } | null,
  timeoutInMilliseconds: number = DRD_CANVAS_LAYOUT_TIMEOUT_MS,
): Promise<boolean> {
  if (!isDrdActive()) {
    return true;
  }

  try {
    await waitForAcceptance(
      () => {
        if (!isDrdActive()) {
          return true;
        }
        resizeActiveViewer();
        const outer = getOuterDimensions();
        return outer != null && outer.width > 0 && outer.height > 0;
      },
      'DMN DRD canvas did not receive layout dimensions after attach',
      timeoutInMilliseconds,
      DRD_CANVAS_LAYOUT_RETRY_INTERVAL_MS,
    );
    return true;
  } catch {
    return false;
  }
}

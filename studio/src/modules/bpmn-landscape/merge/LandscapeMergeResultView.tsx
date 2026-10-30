import type { Bifrost } from '#bifrost/Bifrost';
import type { ElementResolution, ElementResolutionStatus } from '#bifrost/contracts/MergeTypes';

import React from 'react';

import { createLandscapeViewerConfig, LandscapeViewerWithSync } from '../diff/LandscapeViewerWithSync';
import type { LandscapeMergeResult } from './landscapeMergeEngine';

const RESOLUTION_OVERLAYS: Partial<Record<ElementResolutionStatus, [modifier: string, cssClass: string]>> = {
  pending: ['pending', 'ph-duotone ph-warning'],
  reverted: ['reverted', 'ph-duotone ph-arrow-counter-clockwise'],
  'auto-applied': ['auto-applied', 'ph-duotone ph-check'],
  'accepted-ours': ['resolved-ours', 'ph-duotone ph-check-circle'],
  'accepted-theirs': ['resolved-theirs', 'ph-duotone ph-check-circle'],
};

type LandscapeMergeResultViewProps = {
  studio: Bifrost;
  mapUri: string;
  result: LandscapeMergeResult;
  resolutions: ElementResolution[];
  onReady: () => void;
};

/** The read-only merged map, drawn again after every resolution. An invalid result is not drawn. */
export default class LandscapeMergeResultView extends React.Component<LandscapeMergeResultViewProps> {
  private readonly containerRef = React.createRef<HTMLDivElement>();
  private readonly viewer: LandscapeViewerWithSync;
  private hasLoadedMap = false;

  constructor(props: LandscapeMergeResultViewProps) {
    super(props);
    this.viewer = new LandscapeViewerWithSync(createLandscapeViewerConfig(props.studio, props.mapUri));
  }

  componentDidMount(): void {
    if (this.containerRef.current != null) {
      this.viewer.attachTo(this.containerRef.current);
    }
    this.showResult();
    this.viewer.zoomToViewport();
    this.props.onReady();
  }

  componentDidUpdate(prevProps: LandscapeMergeResultViewProps): void {
    if (prevProps.result !== this.props.result) {
      this.showResult();
    }
  }

  componentWillUnmount(): void {
    this.viewer.destroy();
  }

  getViewer(): LandscapeViewerWithSync {
    return this.viewer;
  }

  private showResult(): void {
    const { result, resolutions } = this.props;
    if (result.invalidReason != null) {
      return;
    }
    const canvas = this.viewer.getCanvas();
    const { x, y, width, height } = canvas.viewbox();
    this.viewer.loadMap(result.map);
    for (const { elementId, status } of resolutions) {
      const overlay = RESOLUTION_OVERLAYS[status];
      if (overlay != null) {
        this.viewer.addOverlay(elementId, ...overlay);
      }
    }
    if (this.hasLoadedMap) {
      canvas.viewbox({ x, y, width, height });
    }
    this.hasLoadedMap = true;
  }

  render(): React.JSX.Element {
    const { invalidReason } = this.props.result;
    return (
      <>
        {invalidReason != null && (
          <div className="editor__hint landscape-diff__relation-hint" data-test--landscape-merge-invalid>
            The merged map cannot be written: {invalidReason}
          </div>
        )}
        <div ref={this.containerRef} className="bpmn-merge__result-container landscape-diff__canvas" />
      </>
    );
  }
}

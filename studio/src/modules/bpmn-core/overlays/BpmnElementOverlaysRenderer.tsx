import React from 'react';

import type { Overlay_PartialCover, Overlay_Positioned } from './BpmnElementOverlayManager';
import { OverlayPosition } from './BpmnElementOverlayManager';
import './BpmnElementOverlays.scss';

export type BpmnOverlayRendererProps = {
  height: number;
  width: number;
  cssClassName: string;
  partialCovers: Overlay_PartialCover[];
  positionedOverlays: Overlay_Positioned[];
};

export function renderBpmnElementOverlays(props: BpmnOverlayRendererProps): React.ReactElement {
  return <OverlayRenderer {...props} />;
}

function OverlayRenderer(props: BpmnOverlayRendererProps): React.JSX.Element {
  const toppingOverlays = props.positionedOverlays.filter((overlay) => overlay.position !== OverlayPosition.below);
  const belowOverlays = props.positionedOverlays.filter((overlay) => overlay.position === OverlayPosition.below);

  return (
    <>
      <div
        className={'bpmn-element-overlay-backdrop'}
        style={{
          width: `${props.width}px`,
          height: `${props.height}px`,
        }}
      >
        <div
          className={`bpmn-element-overlay__full-cover ${props.cssClassName}`}
          style={{
            width: `${props.width}px`,
            height: `${props.height}px`,
          }}
        />
        {props.partialCovers.map((cover) => (
          <div
            key={`cover-partial-${crypto.randomUUID}`}
            className={cover.cssClassName}
            style={{
              width: `${cover.width}px`,
              height: `${cover.height}px`,
            }}
          />
        ))}
        {toppingOverlays.length > 0 && (
          <>
            <div className="bpmn-element-overlay__top">
              <div className="bpmn-element-overlay__indicator bpmn-element-overlay__left">
                {toppingOverlays
                  .filter((overlay) => overlay.position === OverlayPosition.topLeft)
                  .map((overlay) => (
                    <overlay.overlayElement {...overlay.overlayProps} key={`overlay-top-left-${crypto.randomUUID}`} />
                  ))}
              </div>
              <div className="bpmn-element-overlay__indicator bpmn-element-overlay__right">
                {toppingOverlays
                  .filter((overlay) => overlay.position === OverlayPosition.topRight)
                  .map((overlay) => (
                    <overlay.overlayElement {...overlay.overlayProps} key={`overlay-top-right-${crypto.randomUUID}`} />
                  ))}
              </div>
            </div>
            <div className="bpmn-element-overlay__middle">
              <div className="bpmn-element-overlay__indicator bpmn-element-overlay__left">
                {toppingOverlays
                  .filter((overlay) => overlay.position === OverlayPosition.middleLeft)
                  .map((overlay) => (
                    <overlay.overlayElement
                      {...overlay.overlayProps}
                      key={`overlay-middle-left-${crypto.randomUUID}`}
                    />
                  ))}
              </div>
              <div className="bpmn-element-overlay__indicator bpmn-element-overlay__right">
                {toppingOverlays
                  .filter((overlay) => overlay.position === OverlayPosition.middleRight)
                  .map((overlay) => (
                    <overlay.overlayElement
                      {...overlay.overlayProps}
                      key={`overlay-middle-right-${crypto.randomUUID}`}
                    />
                  ))}
              </div>
            </div>
            <div className="bpmn-element-overlay__bottom">
              <div className="bpmn-element-overlay__indicator bpmn-element-overlay__left">
                {toppingOverlays
                  .filter((overlay) => overlay.position === OverlayPosition.bottomLeft)
                  .map((overlay) => (
                    <overlay.overlayElement
                      {...overlay.overlayProps}
                      key={`overlay-bottom-left-${crypto.randomUUID}`}
                    />
                  ))}
              </div>
              <div className="bpmn-element-overlay__indicator bpmn-element-overlay__right">
                {toppingOverlays
                  .filter((overlay) => overlay.position === OverlayPosition.bottomRight)
                  .map((overlay) => (
                    <overlay.overlayElement
                      {...overlay.overlayProps}
                      key={`overlay-bottom-right-${crypto.randomUUID}`}
                    />
                  ))}
              </div>
            </div>
          </>
        )}
      </div>

      {belowOverlays.length > 0 && (
        <div
          className="bpmn-element-overlay"
          style={{
            width: `${props.width}px`,
          }}
        >
          <div className="bpmn-element-overlay__below">
            {belowOverlays.map((overlay) => (
              <overlay.overlayElement {...overlay.overlayProps} key={`overlay-controls-${crypto.randomUUID}`} />
            ))}
          </div>
        </div>
      )}
    </>
  );
}

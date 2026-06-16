import type React from 'react';

export declare type Overlay = Overlay_FullCover | Overlay_PartialCover | Overlay_Positioned;

export declare type Overlay_FullCover = {
  type: 'full_cover';
  elementId: string;
  cssClassName: string;
};

export declare type Overlay_PartialCover = {
  type: 'partial_cover';
  elementId: string;
  cssClassName: string;
  height: number;
  width: number;
};

export declare type Overlay_Positioned = {
  type: 'positioned';
  elementId: string;
  position: OverlayPosition;
  overlayElement: React.ReactElement | React.Component;
};

export enum OverlayPosition {
  topLeft = 'topLeft',
  topRight = 'topRight',
  middleLeft = 'middleLeft',
  middleRight = 'middleRight',
  bottomLeft = 'bottomLeft',
  bottomRight = 'bottomRight',
  below = 'below',
}

export declare class BpmnElementOverlayManager {
  update(overlays: Overlay[]): void;
}

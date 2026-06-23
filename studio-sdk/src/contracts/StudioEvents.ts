export type StudioEventName =
  | 'ready'
  | 'settingsUpdate'
  | 'solutionChanged'
  | 'gitStatusChanged'
  | 'pluginOverlayFactoriesChanged'
  | 'unspecifiedGlobalUpdate';

export type StudioSolutionChangedEvent = 'solutionChanged';
export type StudioEmittableEventName = 'unspecifiedGlobalUpdate' | 'pluginOverlayFactoriesChanged';

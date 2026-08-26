export type StudioEventName =
  | 'ready'
  | 'settingsUpdate'
  | 'solutionChanged'
  | 'gitStatusChanged'
  | 'pluginOverlayFactoriesChanged'
  | 'pluginDmnOverlayFactoriesChanged'
  | 'unspecifiedGlobalUpdate';

export type StudioSolutionChangedEvent = 'solutionChanged';
export type StudioEmittableEventName =
  'unspecifiedGlobalUpdate' | 'pluginOverlayFactoriesChanged' | 'pluginDmnOverlayFactoriesChanged';

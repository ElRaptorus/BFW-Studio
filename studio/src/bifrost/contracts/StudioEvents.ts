export type StudioEventName =
  | 'ready'
  | 'settingsUpdate'
  | 'solutionChanged'
  | 'sourceControlStatusChanged'
  | 'sourceControlSelectedRepositoryChanged'
  | 'pluginOverlayFactoriesChanged'
  | 'pluginDmnOverlayFactoriesChanged'
  | 'pluginLandscapeOverlayFactoriesChanged'
  | 'unspecifiedGlobalUpdate';

export type StudioSolutionChangedEvent = 'solutionChanged';
export type StudioEmittableEventName =
  | 'unspecifiedGlobalUpdate'
  | 'pluginOverlayFactoriesChanged'
  | 'pluginDmnOverlayFactoriesChanged'
  | 'pluginLandscapeOverlayFactoriesChanged';

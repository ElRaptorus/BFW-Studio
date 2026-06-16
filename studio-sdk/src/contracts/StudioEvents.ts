export type StudioEventName =
  | 'ready'
  | 'eulaAccepted'
  | 'settingsUpdate'
  | 'solutionChanged'
  | 'gitStatusChanged'
  | 'unspecifiedGlobalUpdate';

export type StudioEulaAcceptedEventName = 'eulaAccepted';
export type StudioSolutionChangedEvent = 'solutionChanged';
export type StudioEmittableEventName = 'unspecifiedGlobalUpdate';

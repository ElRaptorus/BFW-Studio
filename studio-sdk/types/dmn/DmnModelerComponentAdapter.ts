export type DmnViewType = 'drd' | 'decisionTable' | 'literalExpression' | 'boxedExpression';

export type DmnView = {
  readonly id: string;
  readonly name: string;
  readonly type: DmnViewType;
  readonly element: any;
};

export declare class DmnModelerComponentAdapter {
  isReadyForInteraction(): boolean;
  onceInteractive(callbackFn: (...args: any[]) => any): void;
  getActiveView(): DmnView | null;
  getActiveViewType(): DmnViewType | null;
  getViews(): DmnView[];
  getSvg(): Promise<string>;
  isDrdActive(): boolean;
  getDrdCanvas(): any;
  getDrdElementRegistry(): any;
  getDrdCommandStack(): any;
  getDmnSanitizerBridge(): any | null;
}

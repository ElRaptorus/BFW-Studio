export declare type RelativePerformanceEntry = {
  label: string;
  time: number;
  duration: number;
};
export declare type RelativePerformanceEntryWithoutDuration = {
  label: string;
  time: number;
};
export declare class Performance {
  getRelativeEntries(): RelativePerformanceEntry[];
  mark(label: string): void;
}

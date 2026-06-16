const PART_LENGTH = 2;

export type RelativePerformanceEntry = {
  label: string;
  time: number;
  duration: number; // milliseconds
};
export type RelativePerformanceEntryWithoutDuration = {
  label: string;
  time: number;
};

export class Performance {
  public entries: any[];
  private timestamp: (label?: string) => void;

  constructor(entries: any[] = []) {
    this.entries = entries;
    this.timestamp = console.timeStamp ? console.timeStamp.bind(console) : () => {};
  }

  public getRelativeEntries(): RelativePerformanceEntry[] {
    if (this.entries.length === 0) {
      return [];
    }

    const relativeEntries: RelativePerformanceEntryWithoutDuration[] = [];
    const startTime = this.entries[1];
    for (let i = 0; i < this.entries.length; i += PART_LENGTH) {
      relativeEntries.push({ label: this.entries[i], time: this.entries[i + 1] - startTime });
    }

    const entries = relativeEntries.reduce(
      (memo: any[], entry: RelativePerformanceEntryWithoutDuration, index: number) => {
        if (index === 0) {
          return [entry as RelativePerformanceEntry];
        }

        let duration: number | null = null;
        if (entry.label.endsWith(' #end')) {
          const startEntryLabel = entry.label.replace(/ #end$/, ' #start');
          const correspondingStartEntry = [...memo].reverse().find((entry) => entry.label === startEntryLabel);

          if (correspondingStartEntry != null) {
            duration = entry.time - correspondingStartEntry.time;
          }
        }

        const newEntry = { ...entry, duration: duration };

        memo.push(newEntry);

        return memo;
      },
      [],
    );

    return entries;
  }

  public mark(label: string): void {
    this.entries.push(label, Date.now());
    this.timestamp(label);
  }
}

import type { TimerSchedule } from '../helpers/engineApi';

export interface TimerSchedulesContextMetadata {
  engineId: string;
  schedule: TimerSchedule;
  columnId?: string;
  cellValue?: string;
}

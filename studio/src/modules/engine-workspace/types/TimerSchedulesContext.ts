import type { TimerSchedule } from '@elraptorus/bfw_engine_sdk';

export interface TimerSchedulesContextMetadata {
  engineId: string;
  schedule: TimerSchedule;
  columnId?: string;
  cellValue?: string;
}

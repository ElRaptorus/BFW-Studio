export interface TimerSchedulesContextMetadata {
  engineId: string;
  schedule: {
    id: string;
    processModelId: string;
    processVersionId: string;
    flowNodeId: string;
    kind: 'cycle' | 'date' | 'duration';
    isoSpec: string;
    enabled: boolean;
    nextFireAt: string | null;
    lastTriggeredAt?: string | null;
  };
  columnId?: string;
  cellValue?: string;
}

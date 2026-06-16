export interface ModelViewerSelection {
  elementId: string;
  elementType: string;
  elementName: string | null;
  businessObject: Record<string, unknown>;
}

export interface ModelViewerModelData {
  processModelId: string;
  name: string | null;
  version: string | null;
  enabled: boolean;
  deployedAt: string | null;
  xml: string | null;
  versions: { version: string | null; deployedAt: string | null; enabled: boolean }[];
  loading: boolean;
  error: string | null;
  lastUpdated: Date | null;
  engineIsOnline: boolean;
  connectionGracePeriodExpired: boolean;
}

export enum DataObjectDetailLevel {
  showAll = 'showAll',
  hideInputAssociations = 'hideInputAssociations',
  hideAllAssociations = 'hideAllAssociations',
  hideAll = 'hideAll',
}

export function getHumanReadableTextForDataObjectSetting(value: string): string {
  switch (value) {
    case DataObjectDetailLevel.hideAll:
      return 'Hide everything';
    case DataObjectDetailLevel.hideAllAssociations:
      return 'Hide all associations';
    case DataObjectDetailLevel.hideInputAssociations:
      return 'Hide input associations';
    default:
      return 'Show everything';
  }
}

/**
 * Safeguard, in case the user brute forces an invalid value for this setting, via the settings editor.
 * In such cases "showAll" is used as a fallback.
 */
export function showAllDataObjectDetails(value: string): boolean {
  return !(
    value === DataObjectDetailLevel.hideInputAssociations ||
    value === DataObjectDetailLevel.hideAllAssociations ||
    value === DataObjectDetailLevel.hideAll
  );
}

export function hideReadingAssociations(value: string): boolean {
  return value === DataObjectDetailLevel.hideInputAssociations;
}

export function hideAllAssociations(value: string): boolean {
  return value === DataObjectDetailLevel.hideAllAssociations;
}

export function hideAllDataObjectDetails(value: string): boolean {
  return value === DataObjectDetailLevel.hideAll;
}

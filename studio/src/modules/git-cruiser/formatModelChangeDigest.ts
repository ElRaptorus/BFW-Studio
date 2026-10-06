import type { ModelChangeDigest } from '#bifrost/contracts/SourceControlTypes';

/**
 * Formats a digest as one short line, e.g. "2 added · 1 changed · layout moved".
 */
export function formatModelChangeDigest(digest: ModelChangeDigest): string {
  if (digest.fileChange === 'added') {
    return 'New model';
  }

  if (digest.fileChange === 'deleted') {
    return 'Deleted model';
  }

  const parts: string[] = [];

  if (digest.addedElementNames.length > 0) {
    parts.push(`${digest.addedElementNames.length} added`);
  }

  if (digest.modifiedElementNames.length > 0) {
    parts.push(`${digest.modifiedElementNames.length} changed`);
  }

  if (digest.removedElementNames.length > 0) {
    parts.push(`${digest.removedElementNames.length} removed`);
  }

  if (digest.layoutChangedCount > 0) {
    parts.push('layout moved');
  }

  if (digest.fileDetailsChanged) {
    parts.push('file details changed');
  }

  return parts.length > 0 ? parts.join(' · ') : 'No content changes';
}

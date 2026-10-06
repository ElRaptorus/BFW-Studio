const RELATIVE_TIME_FORMAT = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });

const MILLISECONDS_PER_MINUTE = 60_000;
const MINUTES_PER_HOUR = 60;
const HOURS_PER_DAY = 24;

/**
 * "12 minutes ago", "yesterday", "2 weeks ago". Anything under a minute (or slightly in the future because of a
 * clock difference) is "just now". An unparsable date yields an empty string.
 */
export function formatCommitAge(isoDate: string, now: Date): string {
  const commitTime = Date.parse(isoDate);
  if (Number.isNaN(commitTime)) {
    return '';
  }

  const minutes = Math.floor((now.getTime() - commitTime) / MILLISECONDS_PER_MINUTE);
  if (minutes < 1) {
    return 'just now';
  }
  if (minutes < MINUTES_PER_HOUR) {
    return RELATIVE_TIME_FORMAT.format(-minutes, 'minute');
  }

  const hours = Math.floor(minutes / MINUTES_PER_HOUR);
  if (hours < HOURS_PER_DAY) {
    return RELATIVE_TIME_FORMAT.format(-hours, 'hour');
  }

  const days = Math.floor(hours / HOURS_PER_DAY);
  if (days < 7) {
    return RELATIVE_TIME_FORMAT.format(-days, 'day');
  }
  if (days < 30) {
    return RELATIVE_TIME_FORMAT.format(-Math.floor(days / 7), 'week');
  }
  if (days < 365) {
    return RELATIVE_TIME_FORMAT.format(-Math.min(11, Math.floor(days / 30)), 'month');
  }
  return RELATIVE_TIME_FORMAT.format(-Math.floor(days / 365), 'year');
}

export function getHumanizedDuration(milliseconds: number | undefined | null): string {
  if (milliseconds == null || Number.isNaN(milliseconds)) {
    return '--';
  }

  const days = Math.floor(milliseconds / (1000 * 60 * 60 * 24));
  const hours = Math.floor((milliseconds / (1000 * 60 * 60)) % 24);
  const minutes = Math.floor((milliseconds / (1000 * 60)) % 60);
  const seconds = Math.floor((milliseconds / 1000) % 60);

  if (days > 0) {
    return `${days}d ${hours}h ${minutes}m ${seconds}s`;
  }
  if (hours > 0) {
    return `${hours}h ${minutes}m ${seconds}s`;
  }
  if (minutes > 0) {
    return `${minutes}m ${seconds}s`;
  }
  if (seconds > 0) {
    return `${seconds}s`;
  }
  if (milliseconds > 0 && milliseconds < 1) {
    return `${Math.round(milliseconds * 1000)}µs`;
  }

  return `${Math.round(milliseconds)}ms`;
}

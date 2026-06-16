function formatTimestamp(date: Date): string {
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const seconds = String(date.getSeconds()).padStart(2, '0');
  const millis = String(date.getMilliseconds()).padStart(3, '0');
  return `${hours}:${minutes}:${seconds}.${millis}`;
}

export class PluginHostLogger {
  private buffer: string[] = [];
  private maxLines = 10_000;
  private onLogHandler: ((line: string) => void) | null = null;

  append(line: string): void {
    const timestamped = `[${formatTimestamp(new Date())}] ${line}`;
    this.buffer.push(timestamped);
    if (this.buffer.length > this.maxLines) {
      this.buffer.shift();
    }
    this.onLogHandler?.(timestamped);
  }

  getLog(): string[] {
    return [...this.buffer];
  }

  onLog(handler: (line: string) => void): void {
    this.onLogHandler = handler;
  }

  clear(): void {
    this.buffer = [];
  }
}

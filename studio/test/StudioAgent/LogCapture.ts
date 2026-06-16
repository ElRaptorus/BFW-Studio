import * as fs from 'fs';
import * as path from 'path';

import type TestDriver from '../Driver/TestDriver';
import type { StudioAgent } from '../StudioAgent';

const ILLEGAL_CHARS_REGEX = /[^a-z0-9-_.]/gi;

export default class LogCapture {
  private agent: StudioAgent;
  private directory: string;
  private filenamePrefix: string;
  private counter = 0;

  private testDriver: TestDriver;

  constructor(agent: StudioAgent, testDriver: TestDriver, directory: string, filenamePrefix: string) {
    this.agent = agent;
    this.testDriver = testDriver;
    this.directory = directory;
    this.filenamePrefix = filenamePrefix.replace(ILLEGAL_CHARS_REGEX, '-');
  }

  async log(): Promise<void> {
    const webdriverClient = this.testDriver.client as any;

    await fs.promises.mkdir(this.directory, { recursive: true });
    const rendererLogFilename = path.join(this.directory, `${this.getLogBaseName('renderer')}.log`);
    const rendererLogs = (await webdriverClient.getRenderProcessLogs())
      .map((entry: any) => JSON.stringify(entry, null, 2))
      .join('\n');

    await this.saveFile(rendererLogFilename, rendererLogs);
  }

  getLogBaseName(additionalSuffix?: string): string {
    const paddedCounter = this.counter.toString().padStart(3, '0');
    this.counter++;
    const logBaseName = `${this.filenamePrefix}_${paddedCounter}_${this.agent.getNormalizedTestTitle()}`.replace(
      /^_/,
      '',
    );

    if (additionalSuffix != null && additionalSuffix !== '') {
      return `${logBaseName}_${additionalSuffix}`;
    }

    return logBaseName;
  }

  private saveFile(filename: string, data: any): Promise<string> {
    return new Promise((resolve, reject) => {
      fs.writeFile(filename, data, {}, (err: any) => {
        if (err != null) {
          reject(err);
        }

        resolve(filename);
      });
    });
  }
}

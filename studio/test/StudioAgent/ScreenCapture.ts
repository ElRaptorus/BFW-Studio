import * as fs from 'fs';
import * as path from 'path';

import type TestDriver from '../Driver/TestDriver';
import type { StudioAgent } from '../StudioAgent';

const ILLEGAL_CHARS_REGEX = /[^a-z0-9-_.]/gi;

export default class ScreenCapture {
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

  async image(): Promise<string> {
    await fs.promises.mkdir(this.directory, { recursive: true });
    const filename = path.join(this.directory, `${this.getScreenshotBasename()}.png`);
    const nativeImage = await this.testDriver.captureScreenshot();

    return new Promise((resolve, reject) => {
      fs.writeFile(filename, nativeImage, {}, (err: any) => {
        if (err != null) {
          reject(err);
        }

        resolve(filename);
      });
    });
  }

  private getScreenshotBasename(): string {
    const paddedCounter = this.counter.toString().padStart(3, '0');
    this.counter++;
    return `${this.filenamePrefix}_${paddedCounter}_${this.agent.getNormalizedTestTitle()}`.replace(/^_/, '');
  }
}

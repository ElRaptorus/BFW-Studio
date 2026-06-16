import type TestDriver from '../Driver/TestDriver';

export default class InputSimulator {
  private testDriver: TestDriver;

  constructor(testDriver: TestDriver) {
    this.testDriver = testDriver;
  }

  async sendKeyboardInput(keys: string[], pauseAfterEachKey: number): Promise<void> {
    for (const key of keys) {
      const keysToPress = this.getKeysToPress(key);

      this.testDriver.client!.keys(keysToPress);
      await this.pause(pauseAfterEachKey);
    }

    await this.pause(300);
  }

  private getKeysToPress(keystrokes: string) {
    if (keystrokes === ' ') {
      return [' '];
    }

    return keystrokes.split(' ').flatMap((keystroke) => {
      const keys = keystroke !== '-' ? keystroke.split('-') : ['-'];

      const keysToPress = keys.map(this.getKeyToPress);

      return keysToPress;
    });
  }

  private getKeyToPress(key: string) {
    if (key === 'cmd' || key === 'meta') {
      return 'Meta';
    }

    if (key === 'ctrl') {
      return 'Control';
    }

    if (key === 'shift') {
      return 'Shift';
    }

    if (key === 'alt') {
      return 'Alt';
    }

    if (key === 'space') {
      return ' ';
    }

    if (key === 'enter') {
      return '\uE007';
    }

    return key;
  }

  private async pause(timeInMilliseconds: number): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, timeInMilliseconds));
  }
}

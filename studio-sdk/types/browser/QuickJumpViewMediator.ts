import type { QuickJumpOptions } from '../contracts/QuickJumpTypes';

export declare class QuickJumpViewMediator {
  /**
   * Shows the QuickJump control, initialized with the given `options`, setting an optional `itemFilter`.
   *
   * Example:
   *
   *    studio.quickJump.show({
   *      prompt: 'Select favorite color',
   *      entries: [
   *        { type: 'command', label: 'Red', command: 'example.setFavColor', commandArgs: ['Red'] },
   *        { type: 'command', label: 'Green', command: 'example.setFavColor', commandArgs: ['Green'] },
   *      ]
   *    });
   */
  show(options: QuickJumpOptions): void;
}

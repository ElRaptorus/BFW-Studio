import * as assert from 'assert';

import { AbstractEmitter } from './AbstractEmitter';

class SpecificEmitter extends AbstractEmitter {
  triggerTestEvent(): void {
    this.emit('testEvent');
  }
}

describe('AbstractEmitter', () => {
  it('should work', () => {
    const subject = new SpecificEmitter();
    let testValue = 'foo';
    subject.on('testEvent', () => (testValue += 'bar'));
    subject.triggerTestEvent();
    assert.strictEqual(testValue, 'foobar');
    subject.triggerTestEvent();
    assert.strictEqual(testValue, 'foobarbar');
  });

  it('calling dispose() on a subscription should work', () => {
    const subject = new SpecificEmitter();
    let testValue = 'foo';

    const subscription = subject.on('testEvent', () => (testValue += 'bar'));

    subject.triggerTestEvent();
    assert.strictEqual(testValue, 'foobar');

    subscription.dispose();

    subject.triggerTestEvent();
    assert.strictEqual(testValue, 'foobar');
  });
});

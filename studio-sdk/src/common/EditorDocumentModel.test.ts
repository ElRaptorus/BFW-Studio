import * as assert from 'assert';

import { EVENT_DATA_UPDATED, EVENT_METADATA_UPDATED } from '../contracts/internal/EditorEvents';
import { EditorDocumentModel } from './EditorDocumentModel';

class FooModel extends EditorDocumentModel {
  callUpdateCurrentData(value: any): void {
    this.updateCurrentData(value);
  }

  callUpdateMetadata(value: any): void {
    this.updateMetadata(value);
  }
}

const URI = 'foo://bar/baz';

describe('EditorDocumentModel', () => {
  it('can be constructed', () => {
    assert.doesNotThrow(() => new FooModel(URI));
  });

  it('getUri()', () => {
    const model = new FooModel(URI);

    assert.strictEqual(model.getUri(), URI);
  });

  it('updateCurrentData()', () => {
    const model = new FooModel(URI);
    model.releaseEventBuffer();

    let emittedValue = 'bar';
    model.on(EVENT_DATA_UPDATED, (currentData: any) => (emittedValue = currentData));
    model.callUpdateCurrentData('foo');

    assert.deepStrictEqual(emittedValue, { current: 'foo' });
  });

  it('updateCurrentMetadata()', () => {
    const model = new FooModel(URI);
    model.releaseEventBuffer();

    let emittedValue = 'bar';
    model.on(EVENT_METADATA_UPDATED, (metadata: any) => (emittedValue = metadata));
    model.callUpdateMetadata('foo');

    assert.strictEqual(emittedValue, 'foo');
  });
});

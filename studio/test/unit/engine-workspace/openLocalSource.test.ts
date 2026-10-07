import initializeCommands from '#modules/engine-workspace/initializers/initializeCommands';
import { promises as fileSystem } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { describe, expect, it } from 'vitest';

import { createRecordingBifrost, createRecordingConnectionManager } from '../support/recordingBifrost';

const fixtureDirectory = path.resolve(__dirname, '../../fixtures/test-solution-deploy');
const baseUri = pathToFileURL(fixtureDirectory).href;
const uriFor = (file: string) => `${baseUri}/${file}`;

function setup(openSolution: object | null = {}) {
  const { bifrost, calls, registrationOptions } = createRecordingBifrost();
  const opened: string[] = [];
  (bifrost as any).editors = { focusOrOpenEditorDocument: (uri: string) => opened.push(uri) };
  (bifrost as any).solution = {
    getSolution: () => openSolution,
    listIncludedFileUris: async (pattern: RegExp) =>
      fileSystem.readdir(fixtureDirectory).then((fileNames) =>
        fileNames
          .filter((file) => pattern.test(file))
          .sort()
          .map(uriFor),
      ),
  };
  (bifrost as any).files = {
    load: async (uri: string) =>
      fileSystem.readFile(path.join(fixtureDirectory, uri.slice(baseUri.length + 1)), 'utf8'),
  };
  initializeCommands(bifrost, createRecordingConnectionManager(calls));
  const notifications = () =>
    calls.filter((call) => call.method === 'notifications.open').map((call) => call.arguments[0]);
  const isEnabled = (commandArguments: unknown[]) =>
    registrationOptions.get('engine.workspace.openLocalSource')?.enabledWhen?.(...commandArguments) ?? true;
  return { bifrost, opened, notifications, isEnabled };
}

describe('engine.workspace.openLocalSource', () => {
  it('opens the process file found in the solution', async () => {
    const { bifrost, opened } = setup();

    await bifrost.commands.executeCommand('engine.workspace.openLocalSource', ['process', 'order-process']);

    expect(opened).toEqual([uriFor('order-process.bpmn')]);
  });

  it('looks decisions up by definitions id', async () => {
    const { bifrost, opened } = setup();

    await bifrost.commands.executeCommand('engine.workspace.openLocalSource', ['decision', 'discount-rules']);

    expect(opened).toEqual([uriFor('discount-rules.dmn')]);
  });

  it('shows an info notification and opens nothing when no file defines the model', async () => {
    const { bifrost, opened, notifications } = setup();

    await bifrost.commands.executeCommand('engine.workspace.openLocalSource', ['process', 'ghost']);

    expect(opened).toEqual([]);
    expect(notifications()).toEqual([
      { type: 'info', content: "No file in the open solution defines process 'ghost'.", source: 'Engine' },
    ]);
  });

  it('shows the decision notification when no file defines the decision', async () => {
    const { bifrost, opened, notifications } = setup();

    await bifrost.commands.executeCommand('engine.workspace.openLocalSource', ['decision', 'ghost-rules']);

    expect(opened).toEqual([]);
    expect(notifications()).toEqual([
      { type: 'info', content: "No file in the open solution defines decision 'ghost-rules'.", source: 'Engine' },
    ]);
  });

  it('is enabled only with an open solution and a non-empty id', () => {
    expect(setup().isEnabled(['process', 'order-process'])).toBe(true);
    expect(setup(null).isEnabled(['process', 'order-process'])).toBe(false);
    expect(setup().isEnabled(['decision', ''])).toBe(false);
  });
});

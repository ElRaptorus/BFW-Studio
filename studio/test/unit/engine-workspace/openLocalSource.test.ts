import initializeCommands from '#modules/engine-workspace/initializers/initializeCommands';
import { describe, expect, it } from 'vitest';

import { createRecordingBifrost, createRecordingConnectionManager } from '../support/recordingBifrost';

function setup(findResult: string | null, openSolution: object | null = {}) {
  const { bifrost, calls, handlers, registrationOptions } = createRecordingBifrost();
  const opened: string[] = [];
  (bifrost as any).editors = { focusOrOpenEditorDocument: (uri: string) => opened.push(uri) };
  (bifrost as any).solution = { getSolution: () => openSolution };
  const lookups: string[] = [];
  const registerFinder = (name: string) =>
    handlers.set(name, (id: string) => {
      lookups.push(`${name}:${id}`);
      return findResult;
    });
  initializeCommands(bifrost, createRecordingConnectionManager(calls));
  registerFinder('solution.models.findProcessFile');
  registerFinder('solution.models.findDecisionFile');
  const notifications = () =>
    calls.filter((call) => call.method === 'notifications.open').map((call) => call.arguments[0]);
  const isEnabled = (commandArguments: unknown[]) =>
    registrationOptions.get('engine.workspace.openLocalSource')?.enabledWhen?.(...commandArguments) ?? true;
  return { bifrost, opened, lookups, notifications, isEnabled };
}

describe('engine.workspace.openLocalSource', () => {
  it('opens the process file found in the solution', async () => {
    const { bifrost, opened, lookups } = setup('file:///solution/order.bpmn');

    await bifrost.commands.executeCommand('engine.workspace.openLocalSource', ['process', 'order-process']);

    expect(lookups).toEqual(['solution.models.findProcessFile:order-process']);
    expect(opened).toEqual(['file:///solution/order.bpmn']);
  });

  it('looks decisions up by definitions id', async () => {
    const { bifrost, opened, lookups } = setup('file:///solution/rules.dmn');

    await bifrost.commands.executeCommand('engine.workspace.openLocalSource', ['decision', 'discount-rules']);

    expect(lookups).toEqual(['solution.models.findDecisionFile:discount-rules']);
    expect(opened).toEqual(['file:///solution/rules.dmn']);
  });

  it('shows an info notification and opens nothing when no file defines the model', async () => {
    const { bifrost, opened, notifications } = setup(null);

    await bifrost.commands.executeCommand('engine.workspace.openLocalSource', ['process', 'ghost']);

    expect(opened).toEqual([]);
    expect(notifications()).toEqual([
      { type: 'info', content: "No file in the open solution defines process 'ghost'.", source: 'Engine' },
    ]);
  });

  it('shows the decision notification when no file defines the decision', async () => {
    const { bifrost, opened, notifications } = setup(null);

    await bifrost.commands.executeCommand('engine.workspace.openLocalSource', ['decision', 'ghost-rules']);

    expect(opened).toEqual([]);
    expect(notifications()).toEqual([
      { type: 'info', content: "No file in the open solution defines decision 'ghost-rules'.", source: 'Engine' },
    ]);
  });

  it('is enabled only with an open solution and a non-empty id', () => {
    expect(setup(null).isEnabled(['process', 'order-process'])).toBe(true);
    expect(setup(null, null).isEnabled(['process', 'order-process'])).toBe(false);
    expect(setup(null).isEnabled(['decision', ''])).toBe(false);
  });
});

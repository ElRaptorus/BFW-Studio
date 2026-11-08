import { registerInteractionsExportCommands } from '#modules/bpmn-interactions/exportCommands';
import { describe, expect, it, vi } from 'vitest';

vi.mock('#modules/bpmn-interactions/InteractionsDocumentModel', () => ({ default: class {} }));

function fakeBifrost(solution: unknown) {
  const handlers = new Map<string, (...args: unknown[]) => Promise<void>>();
  const showSaveFile = vi.fn(async () => null);
  const bifrost = {
    commands: {
      register: (name: string, handler: (...args: unknown[]) => Promise<void>) => handlers.set(name, handler),
    },
    dialog: { showSaveFile },
    solution: { getSolution: () => solution },
    files: {
      getLocalBasename: (uri: string, stripExtension?: boolean) => {
        const name = uri.split('/').pop() ?? uri;
        return stripExtension ? name.replace(/\.[^.]+$/, '') : name;
      },
      getLocalFilenameForUri: (uri: string) => uri.replace(/^file:\/\//, ''),
      joinPaths: (first: string, second: string) => `${first}/${second}`,
    },
  };
  registerInteractionsExportCommands(bifrost as never);
  return { handlers, showSaveFile };
}

async function defaultPathFor(solution: unknown): Promise<unknown> {
  const { handlers, showSaveFile } = fakeBifrost(solution);
  await handlers.get('std.editor.showExportDialog.bpmn-interactions-map')?.();
  return (showSaveFile.mock.calls[0] as unknown as [{ defaultPath: string }] | undefined)?.[0].defaultPath;
}

describe('interactions export dialog', () => {
  it('suggests an image next to the solution file', async () => {
    const solution = {
      solutionFileUri: 'file:///tmp/MySolution.bfwsln',
      projects: [{ baseUri: 'file:///tmp/project', name: 'project' }],
    };
    expect(await defaultPathFor(solution)).toBe('/tmp/MySolution-interactions.png');
  });

  it('falls back to the first project folder without a solution file', async () => {
    const solution = { solutionFileUri: null, projects: [{ baseUri: 'file:///tmp/project', name: 'project' }] };
    expect(await defaultPathFor(solution)).toBe('/tmp/project/project-interactions.png');
  });

  it('falls back to a bare file name without a solution', async () => {
    expect(await defaultPathFor(null)).toBe('interactions.png');
  });
});

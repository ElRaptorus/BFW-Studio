import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

export type InteractionsWorkspace = {
  workspace: string;
  solutionFile: string;
};

/** A temporary copy of the interactions fixture, saved as a single-folder solution. */
export function createInteractionsWorkspace(prefix: string): InteractionsWorkspace {
  const workspace = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), prefix)));
  fs.cpSync(path.join(__dirname, '..', '..', 'fixtures', 'test-solution-interactions'), workspace, { recursive: true });
  const solutionFile = path.join(workspace, 'Interactions.bfwsln');
  fs.writeFileSync(
    solutionFile,
    `${JSON.stringify(
      {
        folders: [{ path: workspace }],
        settings: {},
      },
      null,
      2,
    )}\n`,
  );
  return { workspace, solutionFile };
}

export function bpmnFileUri(workspace: string, fileName: string): string {
  return `file://${path.join(workspace, fileName)}`;
}

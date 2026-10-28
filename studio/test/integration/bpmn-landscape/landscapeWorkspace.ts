import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

export type LandscapeWorkspace = {
  /** The project folder: a copy of the `test-solution-deploy` fixture. */
  workspace: string;
  /** `landscapes/` in the project folder, declared as `views.landscapes`. */
  landscapeFolder: string;
  solutionFile: string;
};

/**
 * A temporary copy of the deploy fixture, saved as a solution whose landscape folder is `landscapes/` next to the solution file.
 * `withoutProjectFolder` leaves the fixture out and declares no project folder.
 */
export function createLandscapeWorkspace(
  prefix: string,
  options: { declareLandscapeFolder?: boolean; withoutProjectFolder?: boolean } = {},
): LandscapeWorkspace {
  const workspace = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), prefix)));
  const withoutProjectFolder = options.withoutProjectFolder ?? false;
  if (!withoutProjectFolder) {
    fs.cpSync(path.join(__dirname, '..', '..', 'fixtures', 'test-solution-deploy'), workspace, { recursive: true });
  }
  const landscapeFolder = path.join(workspace, 'landscapes');
  const solutionFile = path.join(workspace, 'Landscapes.bfwsln');
  const declareLandscapeFolder = options.declareLandscapeFolder ?? true;
  if (declareLandscapeFolder) {
    fs.mkdirSync(landscapeFolder);
  }
  fs.writeFileSync(
    solutionFile,
    `${JSON.stringify(
      {
        folders: withoutProjectFolder ? [] : [{ path: workspace }],
        ...(declareLandscapeFolder ? { views: { landscapes: { path: 'landscapes' } } } : {}),
      },
      null,
      2,
    )}\n`,
  );
  return { workspace, landscapeFolder, solutionFile };
}

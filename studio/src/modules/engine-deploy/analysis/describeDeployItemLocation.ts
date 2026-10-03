export type DeployProjectRoot = { name: string; baseUri: string };

export type DeployItemLocation = { fileName: string; folder: string };

/**
 * Splits a file URI into its name and the folder it lives in, relative to the project root. In a solution with several
 * projects the folder starts with the project name. Outside every project the absolute folder is returned.
 */
export function describeDeployItemLocation(uri: string, projects: readonly DeployProjectRoot[]): DeployItemLocation {
  const separatorIndex = uri.lastIndexOf('/');
  const fileName = uri.slice(separatorIndex + 1);
  const directory = uri.slice(0, Math.max(separatorIndex, 0));
  const project = projects
    .filter((candidate) => directory === candidate.baseUri || directory.startsWith(`${candidate.baseUri}/`))
    .sort((first, second) => second.baseUri.length - first.baseUri.length)[0];
  if (project == null) {
    return { fileName, folder: directory.replace(/^file:\/\//, '') };
  }
  const relative = directory.slice(project.baseUri.length + 1);
  const folder = projects.length > 1 ? [project.name, relative].filter(Boolean).join('/') : relative;
  return { fileName, folder };
}

/** `folder/fileName`, or just the file name at the project root. */
export function formatDeployItemLocation(location: DeployItemLocation): string {
  return location.folder === '' ? location.fileName : `${location.folder}/${location.fileName}`;
}

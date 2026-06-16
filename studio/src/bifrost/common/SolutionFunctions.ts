import type { Solution } from '../contracts/SolutionTypes';
import { FilePatternMatcher, computeRelativeUri } from './FilePatternMatcher';

/**
 * Returns true if the given `uri` is part of the included files in any of the solution's projects.
 */
export function isUriIncludedInSolution(solution: Solution, uri: string): boolean {
  if (solution == null) {
    return false;
  }

  return solution.projects.some((project) => {
    const relativeUri = computeRelativeUri(uri, project.baseUri);
    const matcher = new FilePatternMatcher(project.files.included, project.files.excluded);

    return matcher.isIncluded(relativeUri) && !matcher.isExcluded(relativeUri);
  });
}

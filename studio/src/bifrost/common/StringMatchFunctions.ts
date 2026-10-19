export function getClosestMatch(searchString: string, listOfStrings: string[]): string | null {
  if (listOfStrings.length === 0) {
    return null;
  }

  const rated = listOfStrings.map((str: string) => {
    return {
      text: str,
      distance: jaroWinklerSimilarity(searchString, str),
    };
  });

  rated.sort(function (left, right) {
    if (left.distance < right.distance) {
      return 1;
    } else if (left.distance > right.distance) {
      return -1;
    } else {
      return 0;
    }
  });

  return rated[0].text;
}

/**
 * Case-sensitive Jaro-Winkler similarity between 0 (no similarity) and 1 (equal).
 * The Winkler prefix bonus (up to 4 characters) only applies above a Jaro similarity of 0.7.
 */
function jaroWinklerSimilarity(first: string, second: string): number {
  if (first.length === 0 || second.length === 0) {
    return 0;
  }
  if (first === second) {
    return 1;
  }

  const matchRange = Math.floor(Math.max(first.length, second.length) / 2) - 1;
  const firstMatches: boolean[] = new Array(first.length).fill(false);
  const secondMatches: boolean[] = new Array(second.length).fill(false);
  let matchCount = 0;

  for (let i = 0; i < first.length; i++) {
    const low = Math.max(0, i - matchRange);
    const high = Math.min(i + matchRange, second.length - 1);
    for (let j = low; j <= high; j++) {
      if (!secondMatches[j] && first[i] === second[j]) {
        firstMatches[i] = true;
        secondMatches[j] = true;
        matchCount++;
        break;
      }
    }
  }

  if (matchCount === 0) {
    return 0;
  }

  let transpositionCount = 0;
  let secondIndex = 0;
  for (let i = 0; i < first.length; i++) {
    if (!firstMatches[i]) {
      continue;
    }
    while (!secondMatches[secondIndex]) {
      secondIndex++;
    }
    if (first[i] !== second[secondIndex]) {
      transpositionCount++;
    }
    secondIndex++;
  }

  const jaroSimilarity =
    (matchCount / first.length + matchCount / second.length + (matchCount - transpositionCount / 2) / matchCount) / 3;
  if (jaroSimilarity <= 0.7) {
    return jaroSimilarity;
  }

  let prefixLength = 0;
  while (prefixLength < 4 && first[prefixLength] === second[prefixLength]) {
    prefixLength++;
  }

  return jaroSimilarity + prefixLength * 0.1 * (1 - jaroSimilarity);
}

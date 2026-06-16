import distance from 'jaro-winkler';

export function getClosestMatch(searchString: string, listOfStrings: string[]): string | null {
  if (listOfStrings.length === 0) {
    return null;
  }

  const rated = listOfStrings.map((str: string) => {
    return {
      text: str,
      distance: distance(searchString, str),
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

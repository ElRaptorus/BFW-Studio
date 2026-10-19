// Each pattern assumes that matches of the patterns before it have already been replaced with whitespace.
const ATTRIBUTE_PATTERN = /(\[[^\]]+\])/g;
const ID_PATTERN = /(#[^\s+>~.[:]+)/g;
const CLASS_PATTERN = /(\.[^\s+>~.[:]+)/g;
const PSEUDO_ELEMENT_PATTERN = /(::[^\s+>~.[:]+|:first-line|:first-letter|:before|:after)/g;
const PSEUDO_CLASS_PATTERN = /(:[^\s+>~.[:]+)/g;
const ELEMENT_PATTERN = /([^\s+>~.[:]+)/g;
const NOT_PATTERN = /:not\(([^)]*)\)/g;
const RULE_BODY_PATTERN = /\{[^]*/gm;
const SEPARATOR_PATTERN = /[*\s+>~]/g;
const STRAY_PATTERN = /[#.]/g;

/**
 * Calculates the CSS specificity of the first selector in a selector list
 * as `ids * 100 + (classes, attributes, pseudo-classes) * 10 + (elements, pseudo-elements)`.
 * The argument of `:not()` counts, the negation itself does not.
 */
export function calculateSelectorSpecificity(selector: string): number {
  const counts = { ids: 0, classes: 0, elements: 0 };

  const countAndRemove = (pattern: RegExp, kind: keyof typeof counts, input: string): string => {
    let remaining = input;
    for (const match of input.match(pattern) ?? []) {
      counts[kind]++;
      remaining = remaining.replace(match, ' ');
    }
    return remaining;
  };

  let remaining = selector.split(',')[0];
  remaining = remaining.replace(NOT_PATTERN, ' $1 ');
  remaining = remaining.replace(RULE_BODY_PATTERN, ' ');
  remaining = countAndRemove(ATTRIBUTE_PATTERN, 'classes', remaining);
  remaining = countAndRemove(ID_PATTERN, 'ids', remaining);
  remaining = countAndRemove(CLASS_PATTERN, 'classes', remaining);
  remaining = countAndRemove(PSEUDO_ELEMENT_PATTERN, 'elements', remaining);
  remaining = countAndRemove(PSEUDO_CLASS_PATTERN, 'classes', remaining);
  remaining = remaining.replace(SEPARATOR_PATTERN, ' ');
  remaining = remaining.replace(STRAY_PATTERN, ' ');
  countAndRemove(ELEMENT_PATTERN, 'elements', remaining);

  return counts.ids * 100 + counts.classes * 10 + counts.elements;
}

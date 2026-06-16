import type { Bifrost } from '#bifrost/Bifrost';

export function initializeDmnHelpTexts(bifrost: Bifrost): void {
  bifrost.helpTexts.registerHelpTexts({
    'dmn/editor': require('../texts/dmn-editor.md'),
    'dmn/decision-tables': require('../texts/dmn-decision-tables.md'),
    'dmn/literal-expressions': require('../texts/dmn-literal-expressions.md'),
    'dmn/boxed-expressions': require('../texts/dmn-boxed-expressions.md'),
    'dmn/drd': require('../texts/dmn-drd.md'),
    'dmn/decision-services': require('../texts/dmn-decision-services.md'),
    'dmn/item-definitions': require('../texts/dmn-item-definitions.md'),
    'dmn/sanitizer': require('../texts/dmn-sanitizer.md'),
    'dmn/properties/documentation': require('../panes/properties/Documentation/PropertiesDocumentation.md'),
  });
}

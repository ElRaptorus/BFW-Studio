import type { Bifrost } from '#bifrost/Bifrost';

export function initializeDmnPanes(bifrost: Bifrost): void {
  bifrost.panes.prependToPaneGroup('right', 'property', [
    bifrost.panes.getPaneViaPaneProvider(
      'dmn/panes/merge/DmnMergeChangeOverview',
      'dmn/pane-providers/merge/DmnMergeChangeOverview',
      require('../merge/panes/DmnMergeChangeOverview'),
    ),
  ]);

  bifrost.panes.prependToPaneGroup('right', 'property', [
    // DRD-level property panes
    bifrost.panes.getPaneViaPaneProvider(
      'dmn/panes/properties/PropertiesDefinitions',
      'dmn/pane-providers/properties/PropertiesDefinitions',
      require('../panes/properties/Definitions/PropertiesDefinitions'),
    ),

    bifrost.panes.getPaneViaPaneProvider(
      'dmn/panes/properties/PropertiesDecision',
      'dmn/pane-providers/properties/PropertiesDecision',
      require('../panes/properties/Decision/PropertiesDecision'),
    ),

    bifrost.panes.getPaneViaPaneProvider(
      'dmn/panes/properties/PropertiesInputData',
      'dmn/pane-providers/properties/PropertiesInputData',
      require('../panes/properties/InputData/PropertiesInputData'),
    ),

    bifrost.panes.getPaneViaPaneProvider(
      'dmn/panes/properties/PropertiesBKM',
      'dmn/pane-providers/properties/PropertiesBKM',
      require('../panes/properties/BusinessKnowledgeModel/PropertiesBKM'),
    ),

    bifrost.panes.getPaneViaPaneProvider(
      'dmn/panes/properties/PropertiesKnowledgeSource',
      'dmn/pane-providers/properties/PropertiesKnowledgeSource',
      require('../panes/properties/KnowledgeSource/PropertiesKnowledgeSource'),
    ),

    bifrost.panes.getPaneViaPaneProvider(
      'dmn/panes/properties/PropertiesDecisionService',
      'dmn/pane-providers/properties/PropertiesDecisionService',
      require('../panes/properties/DecisionService/PropertiesDecisionService'),
    ),

    bifrost.panes.getPaneViaPaneProvider(
      'dmn/panes/properties/PropertiesRequirements',
      'dmn/pane-providers/properties/PropertiesRequirements',
      require('../panes/properties/Requirements/PropertiesRequirements'),
    ),

    // Expression view property panes (Phase 3)
    bifrost.panes.getPaneViaPaneProvider(
      'dmn/panes/properties/PropertiesDecisionTable',
      'dmn/pane-providers/properties/PropertiesDecisionTable',
      require('../panes/properties/DecisionTable/PropertiesDecisionTable'),
    ),

    bifrost.panes.getPaneViaPaneProvider(
      'dmn/panes/properties/PropertiesTableInputs',
      'dmn/pane-providers/properties/PropertiesTableInputs',
      require('../panes/properties/DecisionTable/PropertiesTableInputs'),
    ),

    bifrost.panes.getPaneViaPaneProvider(
      'dmn/panes/properties/PropertiesTableOutputs',
      'dmn/pane-providers/properties/PropertiesTableOutputs',
      require('../panes/properties/DecisionTable/PropertiesTableOutputs'),
    ),

    bifrost.panes.getPaneViaPaneProvider(
      'dmn/panes/properties/PropertiesLiteralExpression',
      'dmn/pane-providers/properties/PropertiesLiteralExpression',
      require('../panes/properties/LiteralExpression/PropertiesLiteralExpression'),
    ),

    bifrost.panes.getPaneViaPaneProvider(
      'dmn/panes/properties/PropertiesBoxedExpression',
      'dmn/pane-providers/properties/PropertiesBoxedExpression',
      require('../panes/properties/BoxedExpression/PropertiesBoxedExpression'),
    ),

    // Phase 4: Item Definitions, Imports, and Validation panes
    bifrost.panes.getPaneViaPaneProvider(
      'dmn/panes/properties/PropertiesItemDefinitions',
      'dmn/pane-providers/properties/PropertiesItemDefinitions',
      require('../panes/properties/ItemDefinitions/PropertiesItemDefinitions'),
    ),

    bifrost.panes.getPaneViaPaneProvider(
      'dmn/panes/properties/PropertiesImports',
      'dmn/pane-providers/properties/PropertiesImports',
      require('../panes/properties/Imports/PropertiesImports'),
    ),

    bifrost.panes.getPaneViaPaneProvider(
      'dmn/panes/properties/PropertiesValidation',
      'dmn/pane-providers/properties/PropertiesValidation',
      require('../panes/properties/Validation/PropertiesValidation'),
    ),
  ]);

  bifrost.panes.prependToPaneGroup('right', 'documentation', [
    bifrost.panes.getPaneViaPaneProvider(
      'dmn/panes/properties/PropertiesDocumentation',
      'dmn/pane-providers/properties/PropertiesDocumentation',
      require('../panes/properties/Documentation/PropertiesDocumentation'),
    ),
  ]);
}

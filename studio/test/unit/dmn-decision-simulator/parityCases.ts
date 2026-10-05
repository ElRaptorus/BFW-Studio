/**
 * Expectation table for the Engine DMN conformance cases C40-C61 (BFW-Engine `test/conformance`).
 * Fixtures live in `test/fixtures/dmn-simulator-parity/`. Inputs are keyed by variable name.
 */
export type ParityCase = {
  caseId: string;
  fixtures: string[];
  /** The fixture whose definitions are the open model; the others are imported. */
  mainFixture: string;
  target: { kind: 'decision' | 'decisionService'; id?: string };
  inputs: Record<string, unknown>;
  expectedResult?: unknown;
  expectedErrorCode?: string;
};

export const PARITY_CASES: ParityCase[] = [
  {
    caseId: 'C40',
    fixtures: ['simple_unique.dmn'],
    mainFixture: 'simple_unique.dmn',
    target: { kind: 'decision' },
    inputs: { age: 25 },
    expectedResult: { discount: 5 },
  },
  {
    caseId: 'C42',
    fixtures: ['literal_expression.dmn'],
    mainFixture: 'literal_expression.dmn',
    target: { kind: 'decision' },
    inputs: { x: 3, y: 7 },
    expectedResult: 10,
  },
  {
    caseId: 'C44',
    fixtures: ['drg_linear_chain.dmn'],
    mainFixture: 'drg_linear_chain.dmn',
    target: { kind: 'decision', id: 'Decision_A' },
    inputs: { x: 5 },
    expectedResult: 30,
  },
  {
    caseId: 'C45',
    fixtures: ['drg_diamond.dmn'],
    mainFixture: 'drg_diamond.dmn',
    target: { kind: 'decision', id: 'Decision_A' },
    inputs: { x: 1 },
    expectedResult: 34,
  },
  {
    caseId: 'C46',
    fixtures: ['bkm_invocation_literal.dmn'],
    mainFixture: 'bkm_invocation_literal.dmn',
    target: { kind: 'decision', id: 'Decision_tax' },
    inputs: { income: 50000, taxRate: 0.2 },
    expectedResult: 10100,
  },
  {
    caseId: 'C48',
    fixtures: ['imported_helper.dmn', 'importing_model.dmn'],
    mainFixture: 'importing_model.dmn',
    target: { kind: 'decision', id: 'Decision_final' },
    inputs: { base: 5 },
    expectedResult: 20,
  },
  {
    caseId: 'C49',
    fixtures: ['boxed_context_basic.dmn'],
    mainFixture: 'boxed_context_basic.dmn',
    target: { kind: 'decision', id: 'Decision_context' },
    inputs: {},
    expectedResult: 11,
  },
  {
    caseId: 'C50',
    fixtures: ['boxed_invocation_basic.dmn'],
    mainFixture: 'boxed_invocation_basic.dmn',
    target: { kind: 'decision', id: 'Decision_apply_tax' },
    inputs: {},
    expectedResult: 10000,
  },
  {
    caseId: 'C51',
    fixtures: ['decision_service_basic.dmn'],
    mainFixture: 'decision_service_basic.dmn',
    target: { kind: 'decisionService', id: 'DS_eligibility' },
    inputs: { Age: 30, Income: 50000 },
    expectedResult: { Eligibility: 'approved' },
  },
  {
    caseId: 'C52',
    fixtures: ['boxed_list_basic.dmn'],
    mainFixture: 'boxed_list_basic.dmn',
    target: { kind: 'decision', id: 'Decision_list' },
    inputs: {},
    expectedResult: [10, 20, 30],
  },
  {
    caseId: 'C53',
    fixtures: ['nested_boxed_multi_type.dmn'],
    mainFixture: 'nested_boxed_multi_type.dmn',
    target: { kind: 'decision', id: 'Decision_nested_multi' },
    inputs: {},
    expectedResult: [10, 20, 30],
  },
  {
    caseId: 'C54',
    fixtures: ['relation_basic.dmn'],
    mainFixture: 'relation_basic.dmn',
    target: { kind: 'decision', id: 'Decision_relation' },
    inputs: {},
    expectedResult: [
      { Name: 'Alice', Age: 30 },
      { Name: 'Bob', Age: 25 },
    ],
  },
  {
    caseId: 'C55-true',
    fixtures: ['boxed_conditional_basic.dmn'],
    mainFixture: 'boxed_conditional_basic.dmn',
    target: { kind: 'decision', id: 'Decision_conditional' },
    inputs: { score: 150 },
    expectedResult: 'high',
  },
  {
    caseId: 'C55-false',
    fixtures: ['boxed_conditional_basic.dmn'],
    mainFixture: 'boxed_conditional_basic.dmn',
    target: { kind: 'decision', id: 'Decision_conditional' },
    inputs: { score: 50 },
    expectedResult: 'low',
  },
  {
    caseId: 'C56',
    fixtures: ['boxed_filter_basic.dmn'],
    mainFixture: 'boxed_filter_basic.dmn',
    target: { kind: 'decision', id: 'Decision_filter' },
    inputs: {},
    expectedResult: [3, 4, 5],
  },
  {
    caseId: 'C57-for',
    fixtures: ['boxed_iterators.dmn'],
    mainFixture: 'boxed_iterators.dmn',
    target: { kind: 'decision', id: 'Decision_for' },
    inputs: { numbers: [1, 2, 3] },
    expectedResult: [2, 4, 6],
  },
  {
    caseId: 'C57-every',
    fixtures: ['boxed_iterators.dmn'],
    mainFixture: 'boxed_iterators.dmn',
    target: { kind: 'decision', id: 'Decision_every' },
    inputs: { numbers: [1, 2, 3] },
    expectedResult: true,
  },
  {
    caseId: 'C57-some',
    fixtures: ['boxed_iterators.dmn'],
    mainFixture: 'boxed_iterators.dmn',
    target: { kind: 'decision', id: 'Decision_some' },
    inputs: { numbers: [1, 2, 3] },
    expectedResult: false,
  },
  {
    caseId: 'C58',
    fixtures: ['default_output_entry.dmn'],
    mainFixture: 'default_output_entry.dmn',
    target: { kind: 'decision', id: 'Decision_default_single' },
    inputs: { status: 'nonexistent' },
    expectedResult: 'unknown',
  },
  {
    caseId: 'C59',
    fixtures: ['input_values_constraint.dmn'],
    mainFixture: 'input_values_constraint.dmn',
    target: { kind: 'decision', id: 'Decision_constrained' },
    inputs: { grade: 'X' },
    expectedErrorCode: 'input_value_violation',
  },
  {
    caseId: 'C60',
    fixtures: ['decision_service_basic.dmn'],
    mainFixture: 'decision_service_basic.dmn',
    target: { kind: 'decisionService', id: 'DS_eligibility' },
    inputs: { Age: 30 },
    expectedErrorCode: 'missing_service_input',
  },
  {
    caseId: 'C61',
    fixtures: ['bkm_helper_model.dmn', 'imported_bkm_consumer.dmn'],
    mainFixture: 'imported_bkm_consumer.dmn',
    target: { kind: 'decision', id: 'Decision_total_tax' },
    inputs: { amount: 100 },
    expectedResult: 10,
  },
];

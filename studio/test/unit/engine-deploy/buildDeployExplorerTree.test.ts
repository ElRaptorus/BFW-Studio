import { buildDeployExplorerTree } from '#modules/engine-deploy/analysis/buildDeployExplorerTree';
import type { SolutionModelEntry } from '#modules/engine-deploy/analysis/scanSolutionModels';
import { describe, expect, it } from 'vitest';

const root = 'file:///work/solution';
const bpmn = (relativePath: string): SolutionModelEntry => ({
  kind: 'bpmn',
  uri: `${root}/${relativePath}`,
  sha256: 'x',
  processes: [],
  storedLinterScores: [],
});
const dmn = (relativePath: string): SolutionModelEntry => ({
  kind: 'dmn',
  uri: `${root}/${relativePath}`,
  sha256: 'x',
  definitionsId: relativePath,
  namespace: null,
  elements: { decisions: [], businessKnowledgeModels: [], inputData: [] },
});
const dmnEntryAt = (uri: string): SolutionModelEntry => ({ ...dmn('x.dmn'), uri });
const entries: SolutionModelEntry[] = [
  bpmn('top.bpmn'),
  bpmn('orders/order.bpmn'),
  dmn('orders/rules/discount.dmn'),
  { kind: 'invalid', uri: `${root}/orders/broken.bpmn`, error: 'bad xml' },
];
const names = (items: { label: string }[] | undefined): string[] => (items ?? []).map((item) => item.label);

describe('buildDeployExplorerTree', () => {
  it('shows folders and model files in file mode and flattens a single project', () => {
    const tree = buildDeployExplorerTree(entries, [{ name: 'solution', uri: root }], 'file');

    expect(names(tree)).toEqual(['orders', 'top.bpmn']);
    expect(names(tree[0].entries)).toEqual(['rules', 'broken.bpmn', 'order.bpmn']);
  });

  it('shows only folders in project mode', () => {
    const tree = buildDeployExplorerTree(entries, [{ name: 'solution', uri: root }], 'project');

    expect(names(tree)).toEqual(['orders']);
    expect(names(tree[0].entries)).toEqual(['rules']);
    expect(tree[0].entries?.[0].entries).toEqual([]);
  });

  it('gives every folder the model URIs below it and a model count badge', () => {
    const tree = buildDeployExplorerTree(entries, [{ name: 'solution', uri: root }], 'project');

    expect(tree[0].metadata.modelUris.sort()).toEqual(
      [`${root}/orders/broken.bpmn`, `${root}/orders/order.bpmn`, `${root}/orders/rules/discount.dmn`].sort(),
    );
    expect(tree[0].badges).toEqual([{ type: 'number', number: 3 }]);
    expect(tree[0].entries?.[0].metadata).toMatchObject({
      uri: `${root}/orders/rules`,
      modelUris: [`${root}/orders/rules/discount.dmn`],
    });
  });

  it('gives a file its own URI, the model icon and an error badge when it is invalid', () => {
    const tree = buildDeployExplorerTree(entries, [{ name: 'solution', uri: root }], 'file');
    const files = tree[0].entries ?? [];

    expect(files.find((item) => item.label === 'order.bpmn')?.metadata).toEqual({
      kind: 'file',
      uri: `${root}/orders/order.bpmn`,
      modelUris: [`${root}/orders/order.bpmn`],
    });
    expect(files.find((item) => item.label === 'order.bpmn')?.labelIcon).toBe('bpmn/editor-tab/bpmn');
    const broken = files.find((item) => item.label === 'broken.bpmn');
    expect(broken?.badges).toEqual([{ type: 'character', character: '!' }]);
    expect(broken?.labelTooltip).toBe('bad xml');
    expect(tree[0].entries?.[0].entries?.[0].labelIcon).toBe('dmn/editor-tab/dmn');
  });

  it('keeps one node per project in a multi-root solution', () => {
    const other = 'file:///work/other';
    const tree = buildDeployExplorerTree(
      [...entries, dmnEntryAt(`${other}/x.dmn`)],
      [
        { name: 'solution', uri: root },
        { name: 'other', uri: other },
      ],
      'file',
    );

    expect(names(tree)).toEqual(['solution', 'other']);
    expect(names(tree[1].entries)).toEqual(['x.dmn']);
  });
});

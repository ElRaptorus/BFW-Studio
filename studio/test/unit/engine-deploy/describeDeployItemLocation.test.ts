import {
  describeDeployItemLocation,
  formatDeployItemLocation,
} from '#modules/engine-deploy/analysis/describeDeployItemLocation';
import { describe, expect, it } from 'vitest';

const single = [{ name: 'shop', baseUri: 'file:///work/shop' }];
const multiple = [...single, { name: 'billing', baseUri: 'file:///work/billing' }];

describe('describeDeployItemLocation', () => {
  it('returns an empty folder at the project root', () => {
    const location = describeDeployItemLocation('file:///work/shop/order.bpmn', single);
    expect(location).toEqual({ fileName: 'order.bpmn', folder: '' });
    expect(formatDeployItemLocation(location)).toBe('order.bpmn');
  });

  it('keeps the folder relative to the project root', () => {
    const location = describeDeployItemLocation('file:///work/shop/a/b/order.bpmn', single);
    expect(formatDeployItemLocation(location)).toBe('a/b/order.bpmn');
  });

  it('prefixes the project name in a multi-root solution and tells equal names apart', () => {
    const first = describeDeployItemLocation('file:///work/shop/order.bpmn', multiple);
    const second = describeDeployItemLocation('file:///work/billing/x/order.bpmn', multiple);
    expect(first.folder).toBe('shop');
    expect(second.folder).toBe('billing/x');
  });

  it('prefers the longest matching project and does not match sibling prefixes', () => {
    const nested = [...single, { name: 'inner', baseUri: 'file:///work/shop/inner' }];
    expect(describeDeployItemLocation('file:///work/shop/inner/a.bpmn', nested).folder).toBe('inner');
    expect(describeDeployItemLocation('file:///work/shopping/a.bpmn', single).folder).toBe('/work/shopping');
  });
});

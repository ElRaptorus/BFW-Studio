import { PluginBpmnContributionStore } from '#modules/bpmn-core/PluginBpmnContributionStore';
import { describe, expect, it } from 'vitest';

const entry = (id: string, title = id) => ({ id, icon: 'ph-light ph-flag', title, command: 'mark' });

describe('PluginBpmnContributionStore palette entries', () => {
  it('keeps runtime entries out of the manifest list it was given', () => {
    const store = new PluginBpmnContributionStore();
    const manifestEntries = [entry('from-manifest')];
    store.setPaletteEntries('probe', manifestEntries);

    store.addPaletteEntry('probe', entry('at-runtime'));
    store.removePaletteEntry('probe', 'from-manifest');

    expect(manifestEntries.map((candidate) => candidate.id)).toEqual(['from-manifest']);
    expect(
      store
        .getAllPaletteEntries()
        .get('probe')
        ?.map((candidate) => candidate.id),
    ).toEqual(['at-runtime']);
  });

  it('replaces an entry that is registered again under the same id', () => {
    const store = new PluginBpmnContributionStore();
    store.addPaletteEntry('probe', entry('tool', 'First'));
    store.addPaletteEntry('probe', entry('tool', 'Second'));

    expect(store.getAllPaletteEntries().get('probe')).toEqual([entry('tool', 'Second')]);
    expect(store.removePaletteEntry('probe', 'tool')).toBe(true);
    expect(store.getAllPaletteEntries().get('probe')).toEqual([]);
  });
});

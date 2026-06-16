/**
 * Tree View Demo — demonstrates the Tree View API.
 *
 * Registers a tree view in the left panel area and pushes sample
 * data on activation. Exposes commands for updating and clearing
 * tree data, and for verifying click-to-command behavior.
 *
 * Registered commands (all namespaced under `plugin.tree-view-demo.*`):
 *
 *   getClickedItems    → returns metadata from tree item clicks
 *   updateTree         → pushes a fresh tree hierarchy
 *   clearTree          → pushes an empty array to clear the tree
 *   getTreeState       → returns whether tree view is registered + click count
 */

let clickedItems = [];

exports.activate = async (api) => {
  await api.views.registerTreeView({
    id: 'demo-tree',
    title: 'Demo Tree',
    area: 'left',
    icon: 'ph-tree-structure',
  });

  await api.views.updateTreeData('demo-tree', [
    {
      id: 'models',
      type: 'directory',
      label: 'Models',
      icon: 'ph-folder',
      expanded: true,
      children: [
        {
          id: 'model-1',
          type: 'file',
          label: 'process.bpmn',
          icon: 'ph-flow-arrow',
          command: 'onItemClicked',
          metadata: { name: 'process.bpmn', type: 'bpmn' },
          badges: [{ type: 'number', number: 3 }],
        },
        {
          id: 'model-2',
          type: 'file',
          label: 'subprocess.bpmn',
          icon: 'ph-flow-arrow',
          command: 'onItemClicked',
          metadata: { name: 'subprocess.bpmn', type: 'bpmn' },
        },
      ],
    },
    {
      id: 'configs',
      type: 'directory',
      label: 'Configs',
      icon: 'ph-folder',
      children: [
        {
          id: 'config-1',
          type: 'file',
          label: 'settings.json',
          icon: 'ph-file-json',
          command: 'onItemClicked',
          metadata: { name: 'settings.json', type: 'json' },
        },
      ],
    },
  ]);

  await api.commands.register('onItemClicked', async (metadata) => {
    clickedItems.push(metadata);
    return { received: true, metadata };
  });

  await api.commands.register('getClickedItems', async () => {
    return [...clickedItems];
  });

  await api.commands.register('updateTree', async () => {
    await api.views.updateTreeData('demo-tree', [
      {
        id: 'updated-root',
        type: 'directory',
        label: 'Updated',
        icon: 'ph-folder',
        expanded: true,
        children: [
          {
            id: 'updated-file',
            type: 'file',
            label: 'new-file.ts',
            icon: 'ph-file-ts',
            command: 'onItemClicked',
            metadata: { name: 'new-file.ts', type: 'typescript' },
          },
        ],
      },
    ]);
    return { updated: true };
  });

  await api.commands.register('clearTree', async () => {
    await api.views.updateTreeData('demo-tree', []);
    return { cleared: true };
  });

  await api.commands.register(
    'getTreeState',
    async () => {
      return {
        registered: true,
        clickCount: clickedItems.length,
      };
    },
    { visibleInSearch: true, description: 'Tree View Demo: Get State' },
  );
};

exports.deactivate = async () => {};

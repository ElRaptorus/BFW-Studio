import type { Bifrost } from '#bifrost/Bifrost';

/** Header order; the position decides the `alt-<n>` (Windows, Linux) / `cmd-alt-<n>` (macOS) shortcut. */
export const GO_TO_CATEGORY_COMMANDS: readonly { categoryId: string; label: string; command: string }[] = [
  { categoryId: 'home', label: 'Home', command: 'std.workbench.goToHome' },
  { categoryId: 'design', label: 'Design', command: 'std.workbench.goToDesign' },
  { categoryId: 'discover', label: 'Discover', command: 'std.workbench.goToDiscover' },
  { categoryId: 'deploy', label: 'Deploy', command: 'std.workbench.goToDeploy' },
  { categoryId: 'debug', label: 'Debug', command: 'std.workbench.goToDebug' },
  { categoryId: 'control', label: 'Control', command: 'std.workbench.goToControl' },
];

/**
 * Registers the workbench header categories and the pages owned by the std module.
 * Other modules register the pages of their own documents. std loads first, so categories always exist.
 */
export function initializeWorkbenchCategories(bifrost: Bifrost): void {
  const categories = bifrost.categories;

  bifrost.icons.registerIcons({
    'std/category/home': 'ph ph-house',
    'std/category/design': 'ph ph-pencil-ruler',
    'std/category/discover': 'ph ph-binoculars',
    'std/category/deploy': 'ph ph-rocket-launch',
    'std/category/debug': 'ph ph-bug',
    'std/category/control': 'ph ph-gear',
  });

  categories.registerCategory({ id: 'home', label: 'Home', icon: 'std/category/home', placement: 'start', order: 0 });
  categories.registerCategory({
    id: 'design',
    label: 'Design',
    icon: 'std/category/design',
    placement: 'main',
    order: 10,
  });
  categories.registerCategory({
    id: 'discover',
    label: 'Discover',
    icon: 'std/category/discover',
    placement: 'main',
    order: 20,
  });
  categories.registerCategory({
    id: 'deploy',
    label: 'Deploy',
    icon: 'std/category/deploy',
    placement: 'main',
    order: 30,
  });
  categories.registerCategory({
    id: 'debug',
    label: 'Debug',
    icon: 'std/category/debug',
    placement: 'main',
    order: 40,
  });
  categories.registerCategory({
    id: 'control',
    label: 'Control',
    icon: 'std/category/control',
    placement: 'end',
    order: 0,
  });

  bifrost.icons.registerIcons({
    'std/page/welcome': 'ph ph-hand-waving',
    'std/page/settings': 'ph ph-sliders-horizontal',
    'std/page/about': 'ph ph-info',
  });

  categories.registerPage({
    id: 'home/welcome',
    categoryId: 'home',
    label: 'Welcome',
    icon: 'std/page/welcome',
    order: 0,
    defaultDocumentUri: 'about:start',
    editorTabsVisible: false,
    paneAreas: [],
  });
  categories.registerPage({
    id: 'control/settings',
    categoryId: 'control',
    label: 'Settings',
    icon: 'std/page/settings',
    order: 10,
    defaultDocumentUri: 'about:settings',
    editorTabsVisible: false,
    paneAreas: [],
  });
  categories.registerPage({
    id: 'control/about',
    categoryId: 'control',
    label: 'About',
    icon: 'std/page/about',
    order: 40,
    defaultDocumentUri: 'about:about',
    editorTabsVisible: false,
    paneAreas: [],
  });

  bifrost.events.on('settingsUpdate', (key: string, value: unknown) => {
    if (key === 'workbench.categories.showEmpty') {
      categories.setShowEmptyCategories(value === true);
    }
  });
  categories.setShowEmptyCategories(bifrost.settings.get('workbench.categories.showEmpty') === true);

  bifrost.commands.register('std.workbench.activateCategory', (categoryId: string) => {
    categories.activateCategory(categoryId);
  });
  bifrost.commands.register('std.workbench.activatePage', (pageId: string) => {
    categories.activatePage(pageId);
  });

  // Keystrokes map to command names without arguments, so every category needs its own command.
  for (const { categoryId, label, command } of GO_TO_CATEGORY_COMMANDS) {
    bifrost.commands.register(
      command,
      () => {
        categories.activateCategory(categoryId);
      },
      {
        visibleInSearch: true,
        description: `Go to ${label}`,
        enabledWhen: () => categories.isCategoryVisible(categoryId),
      },
    );
  }
}

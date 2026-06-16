/**
 * Theme Demo — declarative + runtime theme contributions.
 *
 * Two themes ("Demo Night", "Demo Day") are contributed declaratively
 * via the manifest.  A third ("Demo Solarized") is registered at
 * runtime via `api.themes.register()` during activation.
 *
 * Registered commands (all namespaced under `plugin.theme-demo.*`):
 *
 *   getActiveTheme            → returns the currently active theme ID
 *   unregisterRuntimeTheme    → unregisters "Demo Solarized"
 *   registerRuntimeTheme      → re-registers "Demo Solarized"
 *   getRuntimeThemeRegistered → returns whether the runtime theme is registered
 */

let runtimeThemeRegistered = false;

const SOLARIZED_THEME = {
  id: 'demoSolarized',
  label: 'Demo Solarized',
  type: 'dark',
  tokens: {
    'theme-bg': '#002b36',
    'theme-fg': '#839496',
    'theme-fg-secondary': '#657b83',
    'theme-fg-muted': '#586e75',
    'theme-fg-placeholder': '#586e75',
    'theme-fg-on-accent': '#fdf6e3',
    'theme-accent': '#268bd2',
    'theme-border': '#073642',
    'theme-border-subtle': '#073642',
    'theme-focus': '#268bd2',
    'theme-link': '#2aa198',
    'theme-shadow': 'rgba(0, 0, 0, 0.5)',
    'theme-surface-primary': '#073642',
    'theme-surface-secondary': '#002b36',
    'theme-surface-elevated': '#094c5e',
    'theme-surface-canvas': '#073642',
    'theme-surface-inset': '#001e26',
    'theme-surface-backdrop': '#002b36',
    'theme-scrollbar-thumb': 'rgba(131, 148, 150, 0.25)',
    'theme-menu-bar-bg': '#073642',
    'theme-menu-bar-fg': '#839496',
    'theme-menu-bar-hover-bg': 'rgba(131, 148, 150, 0.12)',
    'theme-status-bar-bg': '#268bd2',
    'theme-status-bar-fg': '#fdf6e3',
    'theme-status-bar-border': '#002b36',
    'theme-editor-tab-bg': '#073642',
    'theme-editor-tab-hover-bg': '#094c5e',
    'theme-editor-tab-active-bg': '#002b36',
    'theme-editor-tab-active-fg': '#93a1a1',
    'theme-editor-tab-active-border': '#268bd2',
    'theme-editor-bg': '#073642',
    'theme-editor-canvas-bg': '#002b36',
    'theme-pane-bg': '#073642',
    'theme-pane-header-bg': '#094c5e',
    'theme-pane-tab-fg': '#657b83',
    'theme-pane-tab-active-fg': '#93a1a1',
    'theme-tree-bg': '#073642',
    'theme-tree-fg': '#839496',
    'theme-tree-hover-bg': '#094c5e',
    'theme-tree-selected-bg': '#268bd233',
    'theme-tree-selected-fg': '#93a1a1',
    'theme-splitter': '#002b36',
    'theme-splitter-hover': '#657b83',
  },
};

exports.activate = async (api) => {
  await api.themes.register(SOLARIZED_THEME);
  runtimeThemeRegistered = true;

  await api.commands.register(
    'getActiveTheme',
    async () => {
      return api.themes.getActiveTheme();
    },
    { visibleInSearch: true, description: 'Theme Demo: Get Active Theme' },
  );

  await api.commands.register('registerRuntimeTheme', async () => {
    if (runtimeThemeRegistered) {
      return { registered: true, alreadyRegistered: true };
    }
    await api.themes.register(SOLARIZED_THEME);
    runtimeThemeRegistered = true;
    return { registered: true };
  });

  await api.commands.register('unregisterRuntimeTheme', async () => {
    await api.themes.unregister('demoSolarized');
    runtimeThemeRegistered = false;
    return { unregistered: true };
  });

  await api.commands.register('getRuntimeThemeRegistered', async () => {
    return runtimeThemeRegistered;
  });
};

exports.deactivate = async () => {};

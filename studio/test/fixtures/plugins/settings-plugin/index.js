let lastObservedValue = null;

exports.activate = async (api) => {
  await api.settings.register({
    'plugin.settings-plugin.sampleSetting': {
      type: 'string',
      label: 'Sample Setting',
      description: 'A test setting observed by the settings-plugin fixture.',
      category: 'Settings Plugin',
      default: '',
    },
  });

  await api.settings.onDidChange('plugin.settings-plugin.sampleSetting', (newValue) => {
    lastObservedValue = newValue;
  });

  await api.commands.register('getLastObservedSetting', () => lastObservedValue, {
    visibleInSearch: true,
    description: 'Settings Plugin: Get Observed Value',
  });
};

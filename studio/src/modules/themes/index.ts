import type { Bifrost } from '#bifrost/Bifrost';

import './styles/theme.dark-city.scss';
import './styles/theme.forge-world-day.scss';
import './styles/theme.forge-world-night.scss';
import './styles/theme.grey-stone.scss';
import './styles/theme.snow-fall.scss';
import './styles/theme.tomb-world.scss';
import './styles/theme.vscode-dark.scss';
import './styles/theme.vscode-light.scss';
import './styles/theme.zed-dark.scss';
import './styles/theme.zed-light.scss';

export async function onLoad(bifrost: Bifrost): Promise<void> {
  bifrost.theme.registerTheme({
    id: 'forge-world-day',
    label: 'Forge World Day',
    type: 'light',
  });

  bifrost.theme.registerTheme({
    id: 'forge-world-night',
    label: 'Forge World Night',
    type: 'dark',
  });

  bifrost.theme.registerTheme({
    id: 'dark-city',
    label: 'The Dark City',
    type: 'dark',
  });

  bifrost.theme.registerTheme({
    id: 'tomb-world',
    label: 'Tomb World',
    type: 'dark',
  });

  bifrost.theme.registerTheme({
    id: 'snow-fall',
    label: 'Fenris',
    type: 'light',
  });

  bifrost.theme.registerTheme({
    id: 'grey-stone',
    label: 'Medusa',
    type: 'dark',
  });

  bifrost.theme.registerTheme({
    id: 'vscode-light',
    label: 'VS Code Light',
    type: 'light',
  });

  bifrost.theme.registerTheme({
    id: 'vscode-dark',
    label: 'VS Code Dark',
    type: 'dark',
  });

  bifrost.theme.registerTheme({
    id: 'zed-light',
    label: 'Zed Light',
    type: 'light',
  });

  bifrost.theme.registerTheme({
    id: 'zed-dark',
    label: 'Zed Dark',
    type: 'dark',
  });
}

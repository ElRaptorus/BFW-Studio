import { IPC_INVOKE_GET_SYSTEMINFORMATION } from '#bifrost/contracts/IpcEvents';
import { ipcRenderer } from 'electron';

import type { Studio } from '@evil/bifrost_fw_sdk';

import AboutpageRenderer from './AboutpageRenderer';
import AboutpageRendererElectron from './electron-renderer/AboutpageRendererElectron';

declare const __BIFROST_CLIENT__: string;

export function loadAboutPage(studio: Studio): void {
  const Aboutpage = __BIFROST_CLIENT__ === 'electron' ? AboutpageRendererElectron : AboutpageRenderer;

  studio.editors.registerDocumentType('aboutpage', {
    uriMatch: /^about:about$/,
    modelKey: null,
    modelConstructor: null,
    rendererKey: 'AboutpageRenderer',
    rendererConstructor: Aboutpage,
    icon: 'aboutpage/document-type/default',
  });

  studio.icons.registerIcons({
    'aboutpage/document-type/default': 'ph ph-eyeglasses about-page__document--icon',
  });

  studio.commands.register(
    'std.aboutpage.open',
    () => {
      studio.editors.focusOrOpenEditorDocument('about:about', 'About');
    },
    { visibleInSearch: true, description: ['View: About page', 'Bifrost Forge World'] },
  );

  studio.commands.register('std.aboutpage.getSysteminformation', () =>
    ipcRenderer.invoke(IPC_INVOKE_GET_SYSTEMINFORMATION),
  );
}

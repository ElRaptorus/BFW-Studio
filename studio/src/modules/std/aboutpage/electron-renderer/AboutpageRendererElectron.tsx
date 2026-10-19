import { Bifrost } from '#bifrost/Bifrost';
import type { StudioModule } from '#bifrost/common/ModuleManager';
import type { EditorDocumentRendererProps } from '#bifrost/contracts/EditorTypes';
import { EVENT_PLUGIN_LIST_CHANGED } from '#bifrost/contracts/PluginHostTypes';
import type { PluginInfo } from '#bifrost/contracts/PluginHostTypes';
import { Editor } from '#components/editor/Editor';
import { EditorContent } from '#components/editor/EditorContent';

import React, { useEffect, useState } from 'react';

import * as BuildInfo from '../../../../generatedBuildAndProductInfo';
import AboutPageView from '../AboutPageView';

type HostSystemInformation = {
  os: string;
  cpu: string;
  storage: string;
  memory: string;
};

const loadingStateInfo = 'Loading ...';

const initialHostSystem: HostSystemInformation = {
  os: loadingStateInfo,
  cpu: loadingStateInfo,
  storage: loadingStateInfo,
  memory: loadingStateInfo,
};

function readGraphicsModel(): string {
  try {
    const context = document.createElement('canvas').getContext('webgl');
    const debugInfo = context?.getExtension('WEBGL_debug_renderer_info');
    if (!context || !debugInfo) {
      return 'NA';
    }
    const renderer = String(context.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL));
    context.getExtension('WEBGL_lose_context')?.loseContext();

    // e.g. "ANGLE (NVIDIA Corporation, NVIDIA GeForce RTX 4060 Ti/PCIe/SSE2, OpenGL 4.5.0)"
    const model = (renderer.match(/^ANGLE \([^,]+, (.+), [^,]+\)$/)?.[1] ?? renderer)
      .replace(/^ANGLE Metal Renderer: /, '')
      .split(' (')[0]
      .split('/')[0]
      .trim();
    return model || renderer;
  } catch {
    return 'NA';
  }
}

export default function AboutpageRendererElectron(props: EditorDocumentRendererProps): React.JSX.Element {
  const bifrost = Bifrost.cast(props.studio);

  const [hostSystem, setHostSystem] = useState(initialHostSystem);
  // eslint-disable-next-line react/hook-use-state -- the WebGL context is created and released once per mount
  const [graphics] = useState(readGraphicsModel);
  const [plugins, setPlugins] = useState<PluginInfo[]>(() =>
    bifrost.plugins.getPluginList().filter((plugin) => plugin.enabled),
  );

  useEffect(() => {
    let mounted = true;
    async function fetchHostSystemData(): Promise<void> {
      const infos = await props.studio.commands.executeCommand('std.aboutpage.getSysteminformation');
      if (mounted) {
        setHostSystem(infos);
      }
    }

    fetchHostSystemData();
    return () => {
      mounted = false;
    };
  }, [props.studio]);

  useEffect(() => {
    const sub = bifrost.plugins.on(EVENT_PLUGIN_LIST_CHANGED, () => {
      setPlugins(bifrost.plugins.getPluginList().filter((plugin) => plugin.enabled));
    });
    return () => sub.dispose();
  }, [bifrost]);

  return (
    <Editor>
      <EditorContent>
        <div className="about-page">
          <AboutPageView
            productName={BuildInfo.productName}
            releaseChannelName={BuildInfo.releaseChannelName}
            identityParts={[
              BuildInfo.version,
              BuildInfo.releaseChannelName,
              BuildInfo.commit,
              BuildInfo.date,
              process.arch,
            ]}
            runtimeFacts={[
              { label: 'Electron', value: process.versions.electron ?? 'NA' },
              { label: 'Chrome', value: process.versions.chrome ?? 'NA' },
              { label: 'Node', value: process.versions.node ?? 'NA' },
              { label: 'V8', value: process.versions.v8 ?? 'NA' },
            ]}
            computerFacts={[
              { label: 'Operating system', value: hostSystem.os },
              { label: 'CPU', value: hostSystem.cpu },
              { label: 'Memory', value: hostSystem.memory },
              { label: 'Storage', value: hostSystem.storage },
              { label: 'Graphics', value: graphics },
            ]}
            editorFacts={[
              { label: 'bpmn-js', value: BuildInfo.bpmnJsVersion },
              { label: 'dmn-js', value: BuildInfo.dmnJsVersion },
            ]}
            moduleNames={bifrost.modules.getLoadedModules().map((studioModule: StudioModule) => studioModule.name)}
            plugins={plugins.map((plugin) => ({
              name: plugin.name,
              version: plugin.version,
              status: plugin.status,
            }))}
            settings={bifrost.settings.UNSAFE_getSerializedData()}
          />
        </div>
      </EditorContent>
    </Editor>
  );
}

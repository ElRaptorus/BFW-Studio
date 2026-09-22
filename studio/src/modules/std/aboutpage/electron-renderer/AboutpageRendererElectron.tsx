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
  graphics: string;
  docker: string;
};

const loadingStateInfo = 'Loading ...';

const initialHostSystem: HostSystemInformation = {
  os: loadingStateInfo,
  cpu: loadingStateInfo,
  storage: loadingStateInfo,
  memory: loadingStateInfo,
  graphics: loadingStateInfo,
  docker: loadingStateInfo,
};

export default function AboutpageRendererElectron(props: EditorDocumentRendererProps): React.JSX.Element {
  const bifrost = Bifrost.cast(props.studio);

  const [hostSystem, setHostSystem] = useState(initialHostSystem);
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
              { label: 'Graphics', value: hostSystem.graphics },
              { label: 'Docker', value: hostSystem.docker },
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

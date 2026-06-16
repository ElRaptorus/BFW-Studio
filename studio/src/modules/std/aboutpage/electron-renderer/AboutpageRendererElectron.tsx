import { Bifrost } from '#bifrost/Bifrost';
import type { StudioModule } from '#bifrost/common/ModuleManager';
import { EVENT_PLUGIN_LIST_CHANGED } from '#bifrost/contracts/PluginHostTypes';
import ProductNameHeadline from '#components/ProductNameHeadline';
import log from 'electron-log';

import React, { useEffect, useState } from 'react';

import type { EditorDocumentRendererProps, PluginInfo } from '@evil/bifrost_fw_sdk';
import { Editor, EditorContent } from '@evil/bifrost_fw_sdk';

import * as BuildInfo from '../../../../generatedBuildAndProductInfo';

type StudioElectronProps = {
  productName: string;
  version: string;
  releaseChannelName: string;
  arch: string;
  commit: string;
  date: string;
  chrome: string;
  node: string;
  v8: string;
  electron: string;
};

type AboutInformationPropsElectron = {
  bifrost: Bifrost;
  studioInfo: StudioElectronProps;
  modules: StudioModule[];
  plugins: PluginInfo[];
  hostSystem: {
    os: string;
    cpu: string;
    storage: string;
    memory: string;
    graphics: string;
    docker: string;
  };
  settings: any;
  logPath: string;
};

type CopyBoxPropsElectron = {
  studioInfo: StudioElectronProps;
  modules: StudioModule[];
  plugins: PluginInfo[];
  hostSystem: {
    os: string;
    cpu: string;
    storage: string;
    memory: string;
    graphics: string;
    docker: string;
  };
  settings: any;
};

const loadingStateInfo = 'Loading ...';

const initialHostSystem = {
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
        <InformationContainer
          bifrost={bifrost}
          studioInfo={{
            productName: BuildInfo.productName,
            version: BuildInfo.version,
            releaseChannelName: BuildInfo.releaseChannelName,
            commit: BuildInfo.commit,
            date: BuildInfo.date,
            arch: process.arch,
            chrome: process.versions.chrome,
            node: process.versions.node,
            v8: process.versions.v8,
            electron: process.versions.electron,
          }}
          modules={bifrost.modules.getLoadedModules()}
          plugins={plugins}
          logPath={log.transports.file?.getFile().path ?? ''}
          hostSystem={hostSystem}
          settings={bifrost.settings.UNSAFE_getSerializedData()}
        />
      </EditorContent>
    </Editor>
  );
}

function InformationContainer(props: AboutInformationPropsElectron): React.JSX.Element {
  return (
    <div className="about-page">
      <div className="container-fluid">
        <div className="row">
          <div className="col-md-12">
            <ProductNameHeadline
              productName={props.studioInfo.productName}
              releaseChannelName={props.studioInfo.releaseChannelName}
            />
            <p>
              <strong>Version:</strong> {props.studioInfo.version}
            </p>
            <p>You can provide the text below when reporting a problem to help us identify possible solutions.</p>
          </div>
        </div>
      </div>
      <CopyBox
        studioInfo={props.studioInfo}
        hostSystem={props.hostSystem}
        modules={props.modules}
        plugins={props.plugins}
        settings={props.settings}
      />
    </div>
  );
}

function CopyBox(props: CopyBoxPropsElectron): React.JSX.Element {
  const content = `# ${props.studioInfo.productName}

Version: ${props.studioInfo.version}
Release Channel: ${props.studioInfo.releaseChannelName}
Architecture: ${props.studioInfo.arch}
Commit: ${props.studioInfo.commit}
Date: ${props.studioInfo.date}

# Host system

Operating System: ${props.hostSystem.os}
CPU: ${props.hostSystem.cpu}
Storage: ${props.hostSystem.storage}
Memory: ${props.hostSystem.memory}
Graphics: ${props.hostSystem.graphics}
Docker: ${props.hostSystem.docker}

# Components

Electron: ${props.studioInfo.electron}
Chrome: ${props.studioInfo.chrome}
Node: ${props.studioInfo.node}
V8: ${props.studioInfo.v8}

# Loaded modules

${props.modules.map((studioModule) => `- ${studioModule.name}\n`).join('')}

# Loaded plugins

${props.plugins.map((plugin) => `- ${plugin.name} - v${plugin.version} [${plugin.status}]\n`).join('')}

# User settings

\`\`\`
${JSON.stringify(props.settings, null, 2)}
\`\`\`

`;

  return <textarea value={content} className="about-page__textarea" readOnly />;
}

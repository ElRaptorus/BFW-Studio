import { Bifrost } from '#bifrost/Bifrost';
import ProductNameHeadline from '#components/ProductNameHeadline';

import React from 'react';

import type { EditorDocumentRendererProps } from '@evil/bifrost_fw_sdk';
import { Editor, EditorContent } from '@evil/bifrost_fw_sdk';

import * as BuildInfo from '../../../generatedBuildAndProductInfo';

type AboutInformation = {
  studioInfo: {
    productName: string;
    version: string;
    releaseChannelName: string;
    commit: string;
    date: string;
  };
  modules: string[];
  settings: any;
};

export default function AboutpageRenderer(props: EditorDocumentRendererProps): React.JSX.Element {
  const bifrost = Bifrost.cast(props.studio);

  return (
    <Editor>
      <EditorContent>
        <InformationContainer
          studioInfo={{
            productName: BuildInfo.productName,
            version: BuildInfo.version,
            releaseChannelName: BuildInfo.releaseChannelName,
            commit: BuildInfo.commit,
            date: BuildInfo.date,
          }}
          modules={bifrost.modules.getLoadedModules().map((studioModule) => studioModule.name)}
          settings={bifrost.settings.UNSAFE_getSerializedData()}
        />
      </EditorContent>
    </Editor>
  );
}

function InformationContainer(props: AboutInformation): React.JSX.Element {
  return (
    <div className="about-page">
      <div className="container-fluid">
        <div className="row">
          <div className="col-md-12">
            <ProductNameHeadline
              productName={props.studioInfo.productName}
              releaseChannelName={props.studioInfo.releaseChannelName}
            />
            <ul className="list-unstyled">
              <li className="list-item">Version: {props.studioInfo.version}</li>
              <li className="list-item">Commit: {props.studioInfo.commit}</li>
              <li className="list-item">Date: {props.studioInfo.date}</li>
            </ul>

            <h4>Loaded modules</h4>
            <ul className="list-unstyled">
              {props.modules.map((moduleName) => {
                return (
                  <li className="list-item" key={moduleName}>
                    {moduleName}
                  </li>
                );
              })}
            </ul>

            <h4>User settings</h4>
            <pre>{JSON.stringify(props.settings, null, 2)}</pre>
          </div>
        </div>
      </div>
    </div>
  );
}

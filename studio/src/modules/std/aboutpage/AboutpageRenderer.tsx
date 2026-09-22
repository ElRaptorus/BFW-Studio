import { Bifrost } from '#bifrost/Bifrost';
import type { EditorDocumentRendererProps } from '#bifrost/contracts/EditorTypes';
import { Editor } from '#components/editor/Editor';
import { EditorContent } from '#components/editor/EditorContent';

import React from 'react';

import * as BuildInfo from '../../../generatedBuildAndProductInfo';
import AboutPageView from './AboutPageView';

export default function AboutpageRenderer(props: EditorDocumentRendererProps): React.JSX.Element {
  const bifrost = Bifrost.cast(props.studio);

  return (
    <Editor>
      <EditorContent>
        <div className="about-page">
          <AboutPageView
            productName={BuildInfo.productName}
            releaseChannelName={BuildInfo.releaseChannelName}
            identityParts={[BuildInfo.version, BuildInfo.releaseChannelName, BuildInfo.commit, BuildInfo.date]}
            editorFacts={[
              { label: 'bpmn-js', value: BuildInfo.bpmnJsVersion },
              { label: 'dmn-js', value: BuildInfo.dmnJsVersion },
            ]}
            moduleNames={bifrost.modules.getLoadedModules().map((studioModule) => studioModule.name)}
            settings={bifrost.settings.UNSAFE_getSerializedData()}
          />
        </div>
      </EditorContent>
    </Editor>
  );
}

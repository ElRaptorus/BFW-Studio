import { EVENT_SOLUTION_CHANGED } from '#bifrost/common/SolutionManager';
import type { EditorDocumentRendererProps } from '#bifrost/contracts/EditorTypes';
import type { SettingsScopeTarget } from '#bifrost/contracts/SettingsScopeTypes';
import { Editor } from '#components/editor/Editor';
import { EditorContent } from '#components/editor/EditorContent';
import { EditorToolbar } from '#components/editor/EditorToolbar';
import { EditorToolbarButton } from '#components/editor/EditorToolbarButton';
import { EditorToolbarLeft } from '#components/editor/EditorToolbarLeft';
import { EditorToolbarRight } from '#components/editor/EditorToolbarRight';
import { EditorToolbarText } from '#components/editor/EditorToolbarText';

import React, { useEffect, useState } from 'react';

import { SettingsGui } from './gui/SettingsGui';
import { clearPendingScope, onScopeNavigationRequested, peekPendingScope } from './settingsNavigation';

export default function SettingsGuiDocumentRenderer(props: EditorDocumentRendererProps): React.JSX.Element {
  const [target, setTarget] = useState<SettingsScopeTarget>(() => peekPendingScope() ?? { scope: 'user' });

  useEffect(() => {
    clearPendingScope();
    return onScopeNavigationRequested(setTarget);
  }, []);

  useEffect(() => {
    const subscription = props.studio.solution.on(EVENT_SOLUTION_CHANGED, () => {
      setTarget((current) => {
        const available = props.studio.settings.getAvailableScopeTargets();
        const stillAvailable = available.some((candidate) => sameTarget(candidate, current));
        return stillAvailable ? current : { scope: 'user' };
      });
    });
    return () => subscription.dispose();
  }, [props.studio]);

  return (
    <Editor>
      <EditorToolbar>
        <EditorToolbarLeft>
          <EditorToolbarText
            studio={props.studio}
            label={<span className="settings__hint--default">Changes are applied immediately.</span>}
          />
        </EditorToolbarLeft>
        <EditorToolbarRight>
          <EditorToolbarButton
            studio={props.studio}
            icon="settings/editor-toolbar/open-json"
            label="Open JSON Editor"
            tooltip="Open JSON Editor"
            command="std.settings.openSettingsJson"
            commandArgs={[target]}
          />
          {target.scope === 'user' && (
            <EditorToolbarButton
              studio={props.studio}
              icon="settings/editor-toolbar/reset"
              label="Reset settings"
              tooltip="Reset settings"
              command="std.settings.resetToDefault"
            />
          )}
        </EditorToolbarRight>
      </EditorToolbar>
      <EditorContent>
        <div className="settings" data-test-settings>
          <SettingsGui
            studio={props.studio}
            target={target}
            onTargetChange={setTarget}
            onOpenJsonEditor={() => {
              props.studio.commands.executeCommand('std.settings.openSettingsJson', [target]);
            }}
          />
        </div>
      </EditorContent>
    </Editor>
  );
}

function sameTarget(left: SettingsScopeTarget, right: SettingsScopeTarget): boolean {
  if (left.scope !== right.scope) {
    return false;
  }
  if (left.scope === 'project' && right.scope === 'project') {
    return left.projectBaseUri === right.projectBaseUri;
  }
  return true;
}

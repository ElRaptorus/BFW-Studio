import type { Bifrost } from '#bifrost/Bifrost';

import React, { useEffect, useState } from 'react';

import type { FeelEditorVariable } from '@evil/bifrost_fw_sdk';
import { EditorContent } from '@evil/bifrost_fw_sdk';

import { FeelSimulatorEditor } from '../../../components/feel-simulator';

const DEFAULT_EXPRESSION = `if token.amount > 1000 then
  "high"
else
  "standard"`;

export default function FeelEditorExamples(props: any): React.JSX.Element {
  const bifrost: Bifrost = props.bifrost;

  const [variableDefinitions, setVariableDefinitions] = useState<FeelEditorVariable[]>([]);

  useEffect(() => {
    const fetchDefinitions = async (): Promise<void> => {
      try {
        const defs: FeelEditorVariable[] = await bifrost.commands.executeCommand('bpmn.feel.getExpressionContext', []);
        setVariableDefinitions(defs);
      } catch {
        setVariableDefinitions([]);
      }
    };
    fetchDefinitions();
  }, [bifrost]);

  return (
    <EditorContent>
      <div style={{ padding: '0.75rem 1rem', flexShrink: 0 }}>
        <h2 style={{ margin: 0 }}>FEEL Expression Sandbox</h2>
        <p style={{ margin: '0.25rem 0 0', color: 'var(--theme-fg-secondary)' }}>
          Syntax highlighting, autocomplete, linting, and live evaluation for FEEL expressions — the primary scripting
          language for the ThomasTheDaemonEngine. Use this sandbox to prototype and test expressions without a BPMN
          diagram.
        </p>
      </div>
      <div style={{ flex: 1, minHeight: 0 }}>
        <FeelSimulatorEditor
          studio={bifrost as any}
          initialExpression={DEFAULT_EXPRESSION}
          variables={variableDefinitions}
          onChange={() => {}}
          layout="Both"
        />
      </div>
    </EditorContent>
  );
}

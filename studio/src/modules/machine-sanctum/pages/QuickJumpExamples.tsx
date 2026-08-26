import type { QuickJumpOptions } from '#bifrost/contracts/QuickJumpTypes';
import { EditorContent } from '#components/editor/EditorContent';

import React, { Fragment } from 'react';

import type { MachineSanctumExample } from '../contracts/MachineSanctumTypes';
import { QuickJumpExampleRenderer } from './QuickJumpExampleRenderer';

type QuickJumpExample = MachineSanctumExample<QuickJumpOptions>;

export default function QuickjumpExamples(props: any): React.JSX.Element {
  const quickjumpExamples: QuickJumpExample[] = [
    {
      title: 'Some options, no sections',
      data: {
        entries: [
          {
            type: 'callback',
            label: 'label',
            sublabel: 'sublabel',
            callbackFn: () => null,
            badges: [
              {
                type: 'text',
                text: 'Recently used',
              },
            ],
          },
          {
            type: 'command',
            label: 'label2',
            sublabel: 'sublabel2',
            command: 'std.empty',
          },
        ],
      },
    },
    {
      title: 'Several variations of badges and keystrokes',
      data: {
        prompt: '>>>',
        entries: [
          {
            type: 'command',
            label: 'Open command search',
            command: 'std.quickJump.showCommands',
            badges: [
              {
                type: 'icon',
                icon: 'ph-light ph-clock',
              },
              {
                type: 'text',
                text: 'Recently used',
              },
            ],
          },
          {
            type: 'command',
            label: 'Machine Sanctum',
            sublabel: 'about:machine-sanctum',
            command: 'std.editor.focusOrOpenDocument',
            commandArgs: ['about:machine-sanctum'],
            formattedKeystroke: 'cmd+x',
          },
          {
            type: 'command',
            label: '01-Import-starten.bpmn',
            sublabel: 'file:///Users/hello/Downloads/bpmn2/01-Import-starten.bpmn',
            command: 'std.editor.focusOrOpenDocument',
            commandArgs: ['file:///Users/hello/Downloads/bpmn2/01-Import-starten.bpmn'],
            formattedKeystroke: 'cmd+y',
            badges: [
              {
                type: 'text',
                text: 'Other commands',
              },
            ],
          },
          {
            type: 'command',
            label: '03-Tokenisierung.bpmn',
            sublabel: 'file:///Users/hello/Downloads/bpmn2/03-Tokenisierung.bpmn',
            command: 'std.editor.focusOrOpenDocument',
            commandArgs: ['file:///Users/hello/Downloads/bpmn2/03-Tokenisierung.bpmn'],
          },
        ],
      },
    },
  ];

  return (
    <EditorContent>
      <div className="machine-sanctum-subpage">
        <h2>Quickjump Examples</h2>

        {quickjumpExamples.map((quickjumpExample: any, index: number) => (
          <Fragment key={quickjumpExample.title}>
            <QuickJumpExampleRenderer
              bifrost={props.bifrost}
              editorDocument={props.editorDocument}
              title={quickjumpExample.title}
              data={quickjumpExample.data}
              viewMediatorId={`quick-jump-example-${index}`}
            />
            <hr />
          </Fragment>
        ))}
      </div>
    </EditorContent>
  );
}

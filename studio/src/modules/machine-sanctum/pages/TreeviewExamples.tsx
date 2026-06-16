import React, { Fragment } from 'react';

import { EditorContent } from '@evil/bifrost_fw_sdk';

import type { MachineSanctumExample } from '../contracts/MachineSanctumTypes';
import { TREEVIEW_SECTIONS } from './TreeViewExamples/files_Mocks';
import type { TreeviewExampleData } from './TreeviewExampleDataRenderer';
import { TreeviewExampleDataRenderer } from './TreeviewExampleDataRenderer';

type TreeviewExample = MachineSanctumExample<TreeviewExampleData>;

export default function TreeviewExamples(props: any): React.JSX.Element {
  const examples: TreeviewExample[] = [
    {
      title: 'Use-Case: For test results',
      content: [
        `
        test
        `,
      ],
      data: require('./TreeViewExamples/test_results.json'),
    },
    {
      title: 'Use-Case: For search results',
      content: [
        `
        Trees don't have to be deeply nested structures: You can also use them to display search results inside each file and highlight parts of the label.
        `,
      ],
      data: require('./TreeViewExamples/search_results.json'),
    },
    {
      title: 'Use-Case: For lists with action icons and badges',
      content: [
        `
        Action icons are shown to the left of the label icon.
        The small "twistie" triangle used to expand and collapse folders is the most common example of this.
        `,
        `
        Another useful feature are badges, which can be used to annotate entries (shown on the right side of the item).
        `,
        `
        You can have multiple \`badges\`, which are separated by commas. This also applies to \`icon\` badges.
        `,
      ],
      data: require('./TreeViewExamples/lists_with_action_icons_and_badges.json'),
    },
    {
      title: 'Use-Case: For file trees',
      data: {
        entries: JSON.parse(JSON.stringify(TREEVIEW_SECTIONS)),
      },
    },
    {
      title: 'Experimental: As a list, with action inputs',
      content: [
        `
        We can also display checkboxes in front of entries to make them selectable.
        `,
      ],
      data: {
        entries: [
          {
            type: 'file',
            actionInput: 'checkbox',
            label: 'http://staging.test',
            labelIcon: 'ph-duotone ph-cloud',
            metadata: {
              uri: 'http://staging.test',
            },
            styles: {
              labelColor: 'orange',
              badgeColor: 'orange',
            },
            badges: [
              {
                type: 'icon',
                icon: 'ph-fill ph-lightning',
              },
              {
                type: 'character',
                character: 'ERR',
              },
            ],
          },
          {
            type: 'file',
            actionInput: 'checkbox',
            label: 'http://localhost:8080',
            labelIcon: 'ph-light ph-hard-drive',
            metadata: {
              uri: 'http://localhost:8080',
            },
            styles: {
              labelColor: 'green',
              badgeColor: 'green',
            },
            badges: [
              {
                type: 'number',
                number: 1,
              },
              {
                type: 'character',
                character: 'D',
              },
            ],
          },
          {
            type: 'file',
            actionInput: 'checkbox',
            label: 'http://localhost:80',
            labelIcon: 'ph-light ph-hard-drive',
            metadata: {
              uri: 'http://localhost:80',
            },
            styles: {
              labelColor: 'blue',
              badgeColor: '#f4229c',
            },
            badges: [
              {
                type: 'number',
                number: 5,
              },
            ],
          },
        ],
      },
    },
  ];

  return (
    <EditorContent>
      <div className="machine-sanctum-subpage">
        <h3>Treeview Examples</h3>

        {examples.map((treeviewExample: any, index: number) => (
          <Fragment key={index}>
            <TreeviewExampleDataRenderer
              bifrost={props.bifrost}
              editorDocument={props.editorDocument}
              title={treeviewExample.title}
              content={treeviewExample.content}
              data={treeviewExample.data}
              viewMediatorId={`treeview-example-${index}`}
            />
            <hr />
          </Fragment>
        ))}
      </div>
    </EditorContent>
  );
}

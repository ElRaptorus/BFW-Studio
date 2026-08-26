import type { Bifrost } from '#bifrost/Bifrost';
import type { DialogOptions } from '#bifrost/contracts/DialogTypes';
import { EditorContent } from '#components/editor/EditorContent';

import React, { Fragment } from 'react';

import type { MachineSanctumExample } from '../contracts/MachineSanctumTypes';
import { DialogExampleRenderer } from './DialogExampleRenderer';

type DialogExample = MachineSanctumExample<DialogOptions>;

export default function DialogExamples(props: any): React.JSX.Element {
  const dialogOptionsArray: DialogExample[] = [
    {
      data: {
        title: 'Unexpected error!',
        content: 'The editor has *crashed*.',
        actions: [
          {
            label: 'Cancel',
            response: 'cancel',
            cancel: true,
          },
          {
            response: 'submit',
            label: 'Submit request',
            default: true,
          },
        ],
      },
    },
    {
      data: {
        title: 'Open URL',
        content: [
          {
            type: 'text_input',
            id: 'url',
            placeholder: 'Enter a URL, e.g. http://service.tld',
            focus: true,
          },
        ],
        actions: [{ label: 'Got it!', response: 'close', default: true }],
      },
    },
    {
      data: {
        title: 'Published!',
        content: [
          { type: 'text', text: 'Something has been deployed successfully:' },
          {
            type: 'text_input',
            id: 'url',
            value: 'http://localhost:4000/share/6c373798-877d-4c6e-aeb5-6816ee82f22b#',
            readonly: true,
            hint: 'Share this url with your friends!',
          },
        ],
        actions: [{ label: 'Got it!', response: 'close', default: true }],
      },
    },
    {
      data: {
        title: 'Unexpected error!',
        content: [
          { type: 'text', text: 'Unfortunately, there has been a major error and the editor has crashed.' },
          { type: 'section', text: 'Next steps' },
          {
            type: 'text',
            text: 'We want you to see that we care, which is why we want to ask the following questions:',
          },
          {
            type: 'text_input',
            id: 'general_advice',
            label: 'What should we do?',
            optional: true,
          },
          {
            type: 'text_input',
            id: 'additional_information',
            label: 'Anything else you want to tell us?',
            multiline: true,
            optional: true,
          },
          { type: 'divider' },
          { type: 'text', text: 'Text below the divider' },
        ],
        actions: [
          {
            label: 'cancel',
            response: 'cancel',
            cancel: true,
          },
          {
            response: 'submit',
            label: 'Submit request',
            default: true,
          },
        ],
      },
    },
    {
      data: {
        title: 'Unexpected error!',
        content: [{ type: 'text', text: 'The editor has *crashed*.' }],
        actions: ['okay'],
      },
    },
    {
      data: {
        title: 'Unexpected error!',
        content: [{ type: 'markdown', text: 'The editor has *crashed*.' }],
        actions: ['okay'],
      },
    },
    {
      data: {
        title: 'Update available',
        content: 'Do you want to continue the thing you are doing?',
        actions: [
          {
            label: 'No',
            response: 'no',
          },
          {
            label: 'Yes',
            response: 'yes',
            default: true,
          },
        ],
      },
    },
    {
      data: {
        title: 'Unsaved changes',
        content: 'Do you want to save your changes before closing the document?',
        actions: [
          {
            label: 'Cancel',
            response: 'cancel',
            cancel: true,
          },
          {
            response: 'no',
            label: "Don't save and close",
          },
          {
            response: 'yes',
            label: 'Save and close',
            default: true,
          },
        ],
      },
    },
    {
      data: {
        title: 'Deployed!',
        content: [
          { type: 'text', text: 'Something has been deployed successfully:' },
          {
            type: 'response_link',
            label: 'Open some view',
            icon: 'ph ph-app-window',
            response: 'open-some-view',
          },
          {
            type: 'response_link',
            label: 'Share this url with your friends!',
            sublabel: 'Please be careful with whom you share data.',
            icon: 'ph ph-globe',
            response: 'share-an-url',
          },
          {
            type: 'response_link',
            label: 'or close this case ...',
            icon: 'ph ph-arrow-right',
            response: 'close',
          },
        ],
        actions: [],
      },
    },
    {
      data: {
        title: 'Key-Value Builder',
        content: [
          { type: 'text', text: 'Define key-value pairs using the builder below:' },
          {
            type: 'key_value_builder',
            id: 'my_entries',
            label: 'Configuration',
            keyPlaceholder: 'Variable name',
            valuePlaceholder: 'Value',
            initialEntries: [
              { key: 'name', value: 'John' },
              { key: 'age', value: '42' },
            ],
            hint: 'Values are parsed as primitives: true/false → boolean, numbers → number, null → null, rest → string.',
          },
        ],
        actions: [
          { label: 'Cancel', response: 'cancel', cancel: true },
          { response: 'submit', label: 'Apply', default: true },
        ],
      },
    },
  ];

  return (
    <EditorContent>
      <div className="machine-sanctum-subpage">
        <h2>Dialogs</h2>

        <p className="lead">
          Dialogs are a great UX instrument when we need the user to really pay attention and take immediate action.
        </p>
        <p>
          A password is needed, a decision has to be made, consent has to be given: This is were dialogs can be of great
          service.
        </p>
        <p>Dialogs are modal and do require the user to take immediate action.</p>

        <hr />

        <h3>
          Examples <OpenTwoDialogsExperiment bifrost={props.bifrost} />
        </h3>

        {dialogOptionsArray.map((dialogExample: DialogExample, index: number) => (
          <Fragment key={dialogExampleListKey(dialogExample)}>
            <DialogExampleRenderer
              bifrost={props.bifrost}
              editorDocument={props.editorDocument}
              title={props.title}
              data={dialogExample.data}
              viewMediatorId={`dialog-example-${index}`}
            />
            <hr />
          </Fragment>
        ))}
      </div>
    </EditorContent>
  );
}

function OpenTwoDialogsExperiment(props: any): React.JSX.Element {
  const bifrost: Bifrost = props.bifrost;

  const openTwoDialogsApart = async () => {
    const dialog1: DialogOptions = {
      title: 'Open URL',
      content: [
        {
          type: 'text',
          text: 'This is the first of 3 dialogs that will be queued.',
        },
        {
          type: 'text_input',
          id: 'url',
          placeholder: 'Enter a string, e.g. "Hello World"',
          focus: true,
        },
      ],
      actions: [{ label: 'Got it!', response: 'close', default: true }],
    };
    const dialog3: DialogOptions = {
      title: 'Deployed!',
      content: [
        { type: 'text', text: 'Something has been deployed successfully:' },
        {
          type: 'response_link',
          label: 'Open some view',
          icon: 'ph ph-app-window',
          response: 'open-some-view',
        },
        {
          type: 'response_link',
          label: 'Share this url with your friends!',
          sublabel: 'Please be careful with whom you share data.',
          icon: 'ph ph-globe',
          response: 'share-an-url',
        },
        {
          type: 'response_link',
          label: 'or close this case ...',
          icon: 'ph ph-arrow-right',
          response: 'close',
        },
      ],
      actions: [],
    };

    setTimeout(async () => {
      const dialogResult2 = await bifrost.dialog.showOpenFile();
      console.log('dialogResult2', dialogResult2);
    }, 1000);

    setTimeout(async () => {
      const dialogResult3 = await bifrost.dialog.open(dialog3);
      console.log('dialogResult3', dialogResult3);
    }, 2000);

    const dialogResult1 = await bifrost.dialog.open(dialog1);
    console.log('dialogResult1', dialogResult1);
  };

  return (
    <button className="btn btn-secondary" onClick={() => openTwoDialogsApart()}>
      Launch 3 dialogs a second apart
    </button>
  );
}

function dialogExampleListKey(dialogExample: DialogExample): string {
  const options = dialogExample.data;
  const title = 'title' in options && typeof options.title === 'string' ? options.title : '';
  const content = 'content' in options ? options.content : undefined;

  let contentFingerprint = '';
  if (typeof content === 'string') {
    contentFingerprint = content;
  } else if (Array.isArray(content)) {
    contentFingerprint = content
      .map((contentItem) => {
        if (typeof contentItem === 'string') {
          return contentItem;
        }
        if ('id' in contentItem && typeof contentItem.id === 'string') {
          return `${contentItem.type}:${contentItem.id}`;
        }
        return contentItem.type;
      })
      .join('|');
  }

  return `${title}:${contentFingerprint}`;
}

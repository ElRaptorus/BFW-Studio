const DIRECTORY_ENTRIES = [
  {
    type: 'directory',
    label: 'Alte Ablage',
    labelIcon: 'std/tree/folder-{closed:open}',
    expanded: false,
    entries: [
      {
        type: 'directory',
        label: 'Bifrost Forge World',
        labelIcon: 'std/tree/folder-{closed:open}',
        expanded: true,
        entries: [
          {
            type: 'directory',
            label: 'enterJS',
            expanded: false,
            labelIcon: 'std/tree/folder-{closed:open}',
            entries: [
              {
                type: 'file',
                label: 'Buch-Prozess-Benachrichtigung.bpmn',
                labelIcon: 'std/tree/file',
                metadata: {
                  uri: 'file:///Users/bumzur/Downloads/Alter Schreibtisch/Bifrost Forge World/enterJS/Buch-Prozess-Benachrichtigung.bpmn',
                },
              },
              {
                type: 'file',
                label: 'Buch-Prozess.bpmn',
                labelIcon: 'std/tree/file',
                metadata: {
                  uri: 'file:///Users/bumzur/Downloads/Alter Schreibtisch/Bifrost Forge World/enterJS/Buch-Prozess.bpmn',
                },
              },
              {
                type: 'file',
                label: 'Konferenz-besuchen.bpmn',
                labelIcon: 'std/tree/file',
                metadata: {
                  uri: 'file:///Users/bumzur/Downloads/Alter Schreibtisch/Bifrost Forge World/enterJS/Konferenz-besuchen.bpmn',
                },
              },
              {
                type: 'file',
                label: 'Buch-Prozess-Manuelle-Freigabe.bpmn',
                labelIcon: 'std/tree/file',
                metadata: {
                  uri: 'file:///Users/bumzur/Downloads/Alter Schreibtisch/Bifrost Forge World/enterJS/Buch-Prozess-Manuelle-Freigabe.bpmn',
                },
              },
            ],
          },
          {
            type: 'file',
            label: 'Buch-Prozess.bpmn',
            labelIcon: 'std/tree/file',
            metadata: {
              uri: 'file:///Users/bumzur/Downloads/Alter Schreibtisch/Bifrost Forge World/Buch-Prozess.bpmn',
            },
          },
        ],
      },
      {
        type: 'file',
        label: 'ProcessEngine.NET-Beispiel-gross.bpmn',
        labelIcon: 'std/tree/file',
        metadata: {
          uri: 'file:///Users/bumzur/Downloads/Alter Schreibtisch/ProcessEngine.NET-Beispiel-gross.bpmn',
        },
      },
      {
        type: 'file',
        label: 'ProcessEngine.NET-Basta-Beispiel.bpmn',
        labelIcon: 'std/tree/file',
        metadata: {
          uri: 'file:///Users/bumzur/Downloads/Alter Schreibtisch/ProcessEngine.NET-Basta-Beispiel.bpmn',
        },
      },
      {
        type: 'file',
        label: 'ProcessEngine-Elemente.bpmn',
        labelIcon: 'std/tree/file',
        metadata: { uri: 'file:///Users/bumzur/Downloads/Alter Schreibtisch/ProcessEngine-Elemente.bpmn' },
      },
    ],
  },
  {
    type: 'file',
    label: '01-Import-starten.bpmn',
    labelIcon: 'std/tree/file',
    metadata: { uri: 'file:///Users/bumzur/Downloads/bpmn2/01-Import-starten.bpmn' },
  },
  {
    type: 'file',
    label: 'process_engine_io_release.bpmn',
    labelIcon: 'std/tree/file',
    metadata: { uri: 'file:///Users/bumzur/Downloads/process_engine_io_release.bpmn' },
  },
  {
    type: 'file',
    label: '03-Tokenisierung.bpmn',
    labelIcon: 'std/tree/file',
    metadata: { uri: 'file:///Users/bumzur/Downloads/bpmn2/03-Tokenisierung.bpmn' },
  },
  {
    type: 'file',
    label: '05-event-verarbeitung.bpmn',
    labelIcon: 'std/tree/file',
    metadata: { uri: 'file:///Users/bumzur/Downloads/bpmn2/05-event-verarbeitung.bpmn' },
  },
  {
    type: 'file',
    label: '06-event-routing.bpmn',
    labelIcon: 'std/tree/file',
    metadata: { uri: 'file:///Users/bumzur/Downloads/bpmn2/06-event-routing.bpmn' },
  },
];
const DIRECTORY_DOWNLOADS = {
  type: 'directory',
  label: 'MyProcesses',
  labelIcon: 'std/tree/folder-{closed:open}',
  expanded: true,
  entries: DIRECTORY_ENTRIES,
};
const PROPERTIES = {
  type: 'directory',
  subtype: 'properties',
  label: 'Properties',
  labelIcon: 'std/tree/folder-{closed:open}',
  expanded: true,
  entries: [
    {
      type: 'entry',
      subtype: 'deploy_targets',
      label: 'Deployment Targets',
      labelIcon: 'std/tree/deploy-targets',
      metadata: { uri: 'file:///Users/bumzur/Downloads/bpmn2/06-event-routing.bpmn' },
    },
    {
      type: 'entry',
      subtype: 'properties',
      label: 'Project Settings',
      labelIcon: 'std/tree/properties',
      metadata: { uri: 'file:///Users/bumzur/Downloads/bpmn2/06-event-routing.bpmn' },
    },
    {
      type: 'entry',
      subtype: 'settings',
      label: 'User Settings',
      labelIcon: 'std/tree/settings',
      metadata: { uri: 'file:///Users/bumzur/Downloads/bpmn2/06-event-routing.bpmn' },
    },
  ],
};

export const TREEVIEW_SECTIONS = [
  {
    type: 'section',
    subtype: 'directory',
    label: '~/MyProcesses',
    expanded: true,
    entries: DIRECTORY_ENTRIES,
  },
  {
    type: 'section',
    subtype: 'project',
    label: 'PCI',
    expanded: true,
    entries: [PROPERTIES, DIRECTORY_DOWNLOADS],
  },
  {
    type: 'section',
    subtype: 'solution',
    label: 'PAYONE_MDOS',
    expanded: true,
    entries: [
      {
        type: 'project',
        label: 'PCI',
        labelIcon: 'std/tree/project-{closed:open}',
        expanded: true,
        entries: [PROPERTIES, DIRECTORY_DOWNLOADS],
      },
      {
        type: 'project',
        label: 'Connected2',
        labelIcon: 'std/tree/project-{closed:open}',
        expanded: false,
        entries: [DIRECTORY_DOWNLOADS],
      },
      {
        type: 'project',
        label: 'Non-PCI (MDOS)',
        labelIcon: 'std/tree/project-{closed:open}',
        expanded: false,
        entries: [DIRECTORY_DOWNLOADS],
      },
    ],
  },
];

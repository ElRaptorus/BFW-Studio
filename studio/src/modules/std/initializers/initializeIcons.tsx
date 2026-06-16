import type { Bifrost } from '#bifrost/Bifrost';

import React from 'react';

export function initializeIcons(bifrost: Bifrost): void {
  bifrost.icons.registerIcons({
    'std/help': 'ph ph-question',
    'std/dots-horizontal': (
      <svg>
        <path
          fill="currentColor"
          d="M16,12A2,2 0 0,1 18,10A2,2 0 0,1 20,12A2,2 0 0,1 18,14A2,2 0 0,1 16,12M10,12A2,2 0 0,1 12,10A2,2 0 0,1 14,12A2,2 0 0,1 12,14A2,2 0 0,1 10,12M4,12A2,2 0 0,1 6,10A2,2 0 0,1 8,12A2,2 0 0,1 6,14A2,2 0 0,1 4,12Z"
        />
      </svg>
    ),
    'std/dots-vertical': (
      <svg>
        <path
          fill="currentColor"
          d="M12,16A2,2 0 0,1 14,18A2,2 0 0,1 12,20A2,2 0 0,1 10,18A2,2 0 0,1 12,16M12,10A2,2 0 0,1 14,12A2,2 0 0,1 12,14A2,2 0 0,1 10,12A2,2 0 0,1 12,10M12,4A2,2 0 0,1 14,6A2,2 0 0,1 12,8A2,2 0 0,1 10,6A2,2 0 0,1 12,4Z"
        />
      </svg>
    ),
    'std/menu/checked': 'ph-bold ph-check',
    'std/menubar/hamburger': (
      <svg>
        <path fill="#aaa" d="M3,6H21V8H3V6M3,11H21V13H3V11M3,16H21V18H3V16Z" />
      </svg>
    ),
    'std/menubar/startpage': (
      <svg>
        <path fill="currentColor" d="M10,20V14H14V20H19V12H22L12,3L2,12H5V20H10Z" />
      </svg>
    ),
    'std/menubar/open': 'ph ph-folder-open',
    'std/menubar/open-file': 'ph ph-file-arrow-up',
    'std/menubar/save': 'ph ph-floppy-disk',
    'std/menubar/bifrost_title': 'ph-duotone ph-user',
    'std/menubar/help': (
      <svg>
        <path
          fill="currentColor"
          d="M11,18H13V16H11V18M12,2A10,10 0 0,0 2,12A10,10 0 0,0 12,22A10,10 0 0,0 22,12A10,10 0 0,0 12,2M12,20C7.59,20 4,16.41 4,12C4,7.59 7.59,4 12,4C16.41,4 20,7.59 20,12C20,16.41 16.41,20 12,20M12,6A4,4 0 0,0 8,10H10A2,2 0 0,1 12,8A2,2 0 0,1 14,10C14,12 11,11.75 11,15H13C13,12.75 16,12.5 16,10A4,4 0 0,0 12,6Z"
        />
      </svg>
    ),
    'std/left-pane-item/files': (
      <svg>
        <path
          fill="currentColor"
          d="M15,7H20.5L15,1.5V7M8,0H16L22,6V18A2,2 0 0,1 20,20H8C6.89,20 6,19.1 6,18V2A2,2 0 0,1 8,0M4,4V22H20V24H4A2,2 0 0,1 2,22V4H4Z"
        />
      </svg>
    ),
    'std/left-pane-item/search': 'ph-bold ph-magnifying-glass ph-flip-h',
    'std/left-pane-item/experimental': (
      <svg>
        <path
          fill="currentColor"
          d="M1.5,2.09C2.4,3 3.87,3.73 5.69,4.25C7.41,2.84 9.61,2 12,2C14.39,2 16.59,2.84 18.31,4.25C20.13,3.73 21.6,3 22.5,2.09C22.47,3.72 21.65,5.21 20.28,6.4C21.37,8 22,9.92 22,12A10,10 0 0,1 12,22A10,10 0 0,1 2,12C2,9.92 2.63,8 3.72,6.4C2.35,5.21 1.53,3.72 1.5,2.09M20,12A8,8 0 0,0 12,4A8,8 0 0,0 4,12A8,8 0 0,0 12,20A8,8 0 0,0 20,12M10.5,10C10.5,10.8 9.8,11.5 9,11.5C8.2,11.5 7.5,10.8 7.5,10V8.5L10.5,10M16.5,10C16.5,10.8 15.8,11.5 15,11.5C14.2,11.5 13.5,10.8 13.5,10L16.5,8.5V10M12,17.23C10.25,17.23 8.71,16.5 7.81,15.42L9.23,14C9.68,14.72 10.75,15.23 12,15.23C13.25,15.23 14.32,14.72 14.77,14L16.19,15.42C15.29,16.5 13.75,17.23 12,17.23Z"
        />
      </svg>
    ),
    'std/left-pane-item/settings': (
      <svg viewBox="0 0 24 24">
        <path
          fill="currentColor"
          d="M12,15.5A3.5,3.5 0 0,1 8.5,12A3.5,3.5 0 0,1 12,8.5A3.5,3.5 0 0,1 15.5,12A3.5,3.5 0 0,1 12,15.5M19.43,12.97C19.47,12.65 19.5,12.33 19.5,12C19.5,11.67 19.47,11.34 19.43,11L21.54,9.37C21.73,9.22 21.78,8.95 21.66,8.73L19.66,5.27C19.54,5.05 19.27,4.96 19.05,5.05L16.56,6.05C16.04,5.66 15.5,5.32 14.87,5.07L14.5,2.42C14.46,2.18 14.25,2 14,2H10C9.75,2 9.54,2.18 9.5,2.42L9.13,5.07C8.5,5.32 7.96,5.66 7.44,6.05L4.95,5.05C4.73,4.96 4.46,5.05 4.34,5.27L2.34,8.73C2.21,8.95 2.27,9.22 2.46,9.37L4.57,11C4.53,11.34 4.5,11.67 4.5,12C4.5,12.33 4.53,12.65 4.57,12.97L2.46,14.63C2.27,14.78 2.21,15.05 2.34,15.27L4.34,18.73C4.46,18.95 4.73,19.03 4.95,18.95L7.44,17.94C7.96,18.34 8.5,18.68 9.13,18.93L9.5,21.58C9.54,21.82 9.75,22 10,22H14C14.25,22 14.46,21.82 14.5,21.58L14.87,18.93C15.5,18.67 16.04,18.34 16.56,17.94L19.05,18.95C19.27,19.03 19.54,18.95 19.66,18.73L21.66,15.27C21.78,15.05 21.73,14.78 21.54,14.63L19.43,12.97Z"
        />
      </svg>
    ),
    'std/editor-tab/controls/dots': (
      <svg>
        <circle cx="1.5" cy="6" r="1.5" fill="currentColor" />
        <circle cx="6" cy="6" r="1.5" fill="currentColor" />
        <circle cx="10.5" cy="6" r="1.5" fill="currentColor" />
      </svg>
    ),
    'std/editor-tab/controls/splitview': 'ph ph-columns',
    'std/status-bar/inspectdocument': 'ph-fill ph-file-magnifying-glass',
    'std/status-bar/notifications': 'ph-fill ph-bell',
    'std/status-bar/machine-sanctum': 'ph-duotone ph-copyright statusbar__icon-machine-sanctum',
    'std/status-bar/theme-dark': 'ph-fill ph-moon',
    'std/status-bar/theme-light': 'ph-fill ph-sun',
    'std/status-bar/problems-error': 'ph ph-x-circle',
    'std/status-bar/problems-warning': 'ph ph-warning',
    'std/notification/closed': 'ph ph-x',
    'std/tree/twistie-open': 'ph-fill ph-caret-right treeview__icon--ph-caret-open',
    'std/tree/twistie-closed': 'ph-light ph-caret-right treeview__icon--ph-caret-closed',
    'std/tree/folder-open': 'ph-fill ph-folder-open treeview__icon--ph-folder',
    'std/tree/folder-closed': 'ph-fill ph-folder treeview__icon--ph-folder',
    'std/tree/project-open': 'ph-fill ph-tree-view treeview__icon--ph-tree-open',
    'std/tree/project-closed': 'ph-fill ph-tree-view treeview__icon--ph-tree-closed',
    'std/tree/loading': 'ph-duotone ph-spinner-gap ph-spin',
    'std/tree/file': 'ph-duotone ph-file treeview__icon--ph-file',
    'std/tree/properties': 'ph-duotone ph-toolbox treeview__icon--ph-properties',
    'std/tree/settings': 'ph-duotone ph-detective treeview__icon--ph-settings',
    'std/tree/deploy-targets': 'ph-duotone ph-hard-drives treeview__icon--ph-deploy-targets',
    'std/inspector/document/default/fragment': 'ph-duotone ph-brackets-curly treeview__icon--ph-brackets-curly',
  });
}

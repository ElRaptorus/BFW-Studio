import { AbstractEmitter } from '@evil/bifrost_fw_sdk';

import {
  EVENT_EDITOR_AREA_FOCUS_UPDATED,
  EVENT_EDITOR_AREA_LAYOUT_UPDATED,
  EVENT_EDITOR_DOCUMENT_DATA_UPDATED,
  EVENT_EDITOR_DOCUMENT_METADATA_UPDATED,
} from '../../../../studio-sdk/src/contracts/internal/EditorEvents';
import { EVENT_PANE_LAYOUT_UPDATED } from '../../../../studio-sdk/src/contracts/internal/PaneEvents';
import { EVENT_SETTINGS_CHANGED } from '../../../../studio-sdk/src/contracts/internal/SettingsEvents';
import type { PaneMediator } from '../common/PaneMediator';
import type { SettingsMediator } from '../common/SettingsMediator';
import { EVENT_SOLUTION_CHANGED } from '../common/SolutionManager';
import type { SolutionMediator } from '../common/SolutionMediator';
import type { EditorMediator } from './EditorMediator';

export const EVENT_CONTENT_UPDATE = 'EVENT_CONTENT_UPDATE';

export class EditorsPanesSettingsSolutionEventMediator extends AbstractEmitter {
  constructor(panes: PaneMediator, editors: EditorMediator, settings: SettingsMediator, solution: SolutionMediator) {
    super();

    const emitContentUpdateEvent = () => this.emit(EVENT_CONTENT_UPDATE);

    editors.on(EVENT_EDITOR_AREA_FOCUS_UPDATED, () => emitContentUpdateEvent());
    editors.on(EVENT_EDITOR_AREA_LAYOUT_UPDATED, () => emitContentUpdateEvent());
    editors.on(EVENT_EDITOR_DOCUMENT_DATA_UPDATED, () => emitContentUpdateEvent());
    editors.on(EVENT_EDITOR_DOCUMENT_METADATA_UPDATED, () => emitContentUpdateEvent());
    panes.on(EVENT_PANE_LAYOUT_UPDATED, () => emitContentUpdateEvent());
    settings.on(EVENT_SETTINGS_CHANGED, () => emitContentUpdateEvent());
    solution.on(EVENT_SOLUTION_CHANGED, () => emitContentUpdateEvent());
  }
}

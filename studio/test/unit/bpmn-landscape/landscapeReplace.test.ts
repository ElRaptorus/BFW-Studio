import type {
  LandscapeNoteElement,
  LandscapePlaceholderElement,
  LandscapeProcessElement,
} from '#modules/bpmn-landscape/LandscapeMapFile';
import { convertLandscapeElement } from '#modules/bpmn-landscape/modeler/LandscapeReplace';
import { describe, expect, it } from 'vitest';

const geometry = { parentId: 'group', x: 10, y: 20, width: 140, height: 60, style: { fill: '#fff', stroke: null } };

const process: LandscapeProcessElement = {
  ...geometry,
  id: 'process',
  type: 'process',
  processId: 'order-process',
  fileHint: 'order.bpmn',
  label: null,
  shape: 'chevron',
};

describe('convertLandscapeElement', () => {
  it('turns a process without a label into a placeholder named after the process id, keeping place and shape', () => {
    expect(convertLandscapeElement(process, 'placeholder', 'new')).toEqual({
      ...geometry,
      id: 'new',
      type: 'placeholder',
      label: 'order-process',
      shape: 'chevron',
    });
  });

  it('carries the label of a process over, and drops the reference to the process', () => {
    const converted = convertLandscapeElement({ ...process, label: 'Order' }, 'note', 'new');

    expect(converted).toEqual({ ...geometry, id: 'new', type: 'note', text: 'Order' });
    expect(converted).not.toHaveProperty('processId');
  });

  it('turns a note into a placeholder named after the first line of its text, drawn as a box', () => {
    const note: LandscapeNoteElement = { ...geometry, id: 'note', type: 'note', text: 'Check stock\nthen ship' };

    expect(convertLandscapeElement(note, 'placeholder', 'new')).toEqual({
      ...geometry,
      id: 'new',
      type: 'placeholder',
      label: 'Check stock',
      shape: 'box',
    });
  });

  it('turns a placeholder into a note with the label as text', () => {
    const placeholder: LandscapePlaceholderElement = {
      ...geometry,
      id: 'placeholder',
      type: 'placeholder',
      label: 'Not modelled yet',
      shape: 'box',
    };

    expect(convertLandscapeElement(placeholder, 'note', 'new')).toEqual({
      ...geometry,
      id: 'new',
      type: 'note',
      text: 'Not modelled yet',
    });
  });
});

import type { Bifrost } from '#bifrost/Bifrost';
import { PREDEFINED_COLORS } from '#components/BpmnElementColorPicker';
import type { BpmnElementColor } from '#modules/bpmn-editor/BpmnElementTypes';
import type { ElementLike } from 'diagram-js/lib/model/Types';

const noColor = {
  label: 'No Color',
  backgroundColor: undefined,
  borderColor: undefined,
};
const colors = [noColor, ...PREDEFINED_COLORS];

class ColorContextPadProvider {
  static $inject = ['contextPad', 'modeling'];
  private studio: Bifrost | null = null;

  private contextPad: any;
  private modeling;
  private panel: HTMLDivElement | null = null;

  constructor(contextPad: any, modeling) {
    this.contextPad = contextPad;
    this.modeling = modeling;
    contextPad.registerProvider(this);
  }

  setStudio(studio: Bifrost) {
    this.studio = studio;
  }

  getContextPadEntries(element: ElementLike) {
    return (entries) => {
      entries['custom-color-picker'] = {
        group: 'edit',
        className: 'ph-fill ph-palette',
        title: 'Farbe wählen',
        action: {
          click: () => this.openColorPicker(element),
        },
      };
      return entries;
    };
  }

  openColorPicker(element: ElementLike) {
    const pad = this.contextPad.getPad(element)?.html;

    if (this.panel || !pad || !pad.classList.contains('open')) {
      this.closeColorPicker();
      return;
    }

    if (this.studio) {
      const customColors: BpmnElementColor[] = this.studio.settings.get('bpmn.editor.customColors') ?? [];
      customColors.forEach((color) => {
        if (!colors.some((col) => col.label === color.label)) {
          colors.push(color);
        }
      });
    }

    this.panel = document.createElement('div');
    this.panel.classList.add('color-picker-panel');

    colors.forEach((color) => {
      const btn = document.createElement('div');
      btn.classList.add('color-option');
      btn.style.backgroundColor = color.backgroundColor!;
      if (color.label !== 'No Color') {
        btn.style.borderColor = color.borderColor!;
      }

      btn.onclick = () => {
        this.modeling.setColor(element, { fill: color.backgroundColor, stroke: color.borderColor });
        this.closeColorPicker();
      };

      this.panel!.appendChild(btn);
    });

    const editorContent = document.querySelector('.editor__content');
    if (editorContent) {
      editorContent.appendChild(this.panel);
    } else {
      document.body.appendChild(this.panel);
    }

    const pos = this.getStartPosition([element]);
    this.panel.style.position = 'absolute';
    this.panel.style.left = pos.x + 'px';
    this.panel.style.top = pos.y + 'px';

    this.contextPad._eventBus.on('selection.changed', () => {
      this.closeColorPicker();
    });
  }

  closeColorPicker() {
    if (this.panel) {
      this.panel.remove();
      this.panel = null;
    }
  }

  getStartPosition(elements: ElementLike[]) {
    const Y_OFFSET = 5;
    const pad = this.contextPad.getPad(elements).html;

    if (!pad) {
      return { x: 0, y: 0 };
    }

    const padRect = pad.getBoundingClientRect();

    const editorContent = document.querySelector('.editor__content') as HTMLElement;
    const editorRect = editorContent?.getBoundingClientRect();

    return {
      x: padRect.left - (editorRect?.left ?? 0),
      y: padRect.bottom - (editorRect?.top ?? 0) + Y_OFFSET,
    };
  }
}

export default {
  __init__: ['colorContextPadProvider'],
  colorContextPadProvider: ['type', ColorContextPadProvider],
};

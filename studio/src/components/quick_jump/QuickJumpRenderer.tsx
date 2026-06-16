import type { QuickJumpItem, QuickJumpItemBadge } from '#bifrost/contracts/QuickJumpTypes';

import React from 'react';

import type { IconComponent } from '@evil/bifrost_fw_sdk';
import { FormInput } from '@evil/bifrost_fw_sdk';

import { AutoScrollContainer } from '../../../../studio-sdk/src/components/internal/AutoScrollContainer';

type QuickJumpRendererProps = {
  iconComponent: IconComponent;
  prompt: string;
  initialInputValue?: string;
  entries: QuickJumpItem[];
  selectedIndex?: number;
  setQuery: (query: string) => void;
  onBlur: () => void;
  openEntryAndClose: (entry: QuickJumpItem, event: any) => void;
  openSelectedEntryAndClose: (event: any) => void;
};

export default function QuickJumpRenderer(props: QuickJumpRendererProps): React.JSX.Element {
  return (
    <div className="quick-jump">
      <FormInput
        className="quick-jump__input"
        type="text"
        value={props.initialInputValue || ''}
        placeholder={` ${props.prompt || ''}`}
        key="quick-jump-input"
        onBlur={() => props.onBlur()}
        onChange={(value: any) => props.setQuery(value)}
      />
      <AutoScrollContainer className="quick-jump__entries" elementClassName="quick-jump__entry--focused">
        {props.entries.map((entry: QuickJumpItem, index: number) => (
          <QuickJumpEntry
            key={`${index}-${entry.label}`}
            entry={entry}
            iconComponent={props.iconComponent}
            index={index}
            selectedIndex={props.selectedIndex}
            openEntryAndClose={props.openEntryAndClose}
          />
        ))}
        {props.entries.length === 0 && (
          <div className={`quick-jump__entry quick-jump__entry--no-focus`}>
            <span className="quick-jump__sublabel">No matches found.</span>
          </div>
        )}
      </AutoScrollContainer>
    </div>
  );
}

function QuickJumpEntry(props: any): React.JSX.Element {
  const entry = props.entry;
  const classNames = [
    'quick-jump__entry',
    entry.icon != null ? 'quick-jump__entry--with-icon' : '',
    props.index === props.selectedIndex ? 'quick-jump__entry--focused' : '',
  ];
  const label = entry.label.split('\n')[0];
  const hasKeystroke = entry.type === 'command' && entry.formattedKeystroke != null;

  let onClick;
  if (entry.type === 'command' || entry.type === 'callback') {
    onClick = (event: any) => props.openEntryAndClose(entry, event);
  }

  return (
    <div className={classNames.join(' ')} key={entry.label} onClick={onClick}>
      <QuickJumpEntryLabel
        icon={entry.icon}
        label={label}
        labelHighlight={entry.labelHighlight}
        sublabel={entry.sublabel}
        sublabelHighlight={entry.sublabelHighlight}
        iconComponent={props.iconComponent}
      />
      {entry.badges && <QuickJumpEntryBadges badges={entry.badges} iconComponent={props.iconComponent} />}
      {hasKeystroke && <QuickJumpEntryKeystroke formattedKeystroke={entry.formattedKeystroke} />}
    </div>
  );
}

function QuickJumpEntryLabel(props: any): React.JSX.Element {
  const Icon = props.iconComponent;

  return (
    <span className="quick-jump__label-container">
      {props.icon && (
        <span className="quick-jump__icon">
          <Icon id={props.icon} />
        </span>
      )}
      <span
        className="quick-jump__label"
        dangerouslySetInnerHTML={{ __html: highlight(props.label, props.labelHighlight) }}
      />
      {props.sublabel && (
        <span
          className="quick-jump__sublabel"
          dangerouslySetInnerHTML={{ __html: highlight(props.sublabel, props.sublabelHighlight) }}
        />
      )}
    </span>
  );
}

function QuickJumpEntryBadges(props: any): React.JSX.Element {
  return (
    <span className="quick-jump__badge">
      {props.badges.map((badge: QuickJumpItemBadge, index: number) => {
        switch (badge.type) {
          case 'text':
            return <span key={`${props.label}-${index}`}>{badge.text}</span>;
          case 'icon': {
            const Icon = props.iconComponent;
            return <Icon id={badge.icon} key={`${props.label}-${index}`} />;
          }
          default:
            throw new Error(`Could not render badge: ${JSON.stringify(badge)}`);
        }
      })}
    </span>
  );
}

function QuickJumpEntryKeystroke(props: any): React.JSX.Element {
  return (
    <span className="quick-jump__keystroke">
      <span className="keystroke">{props.formattedKeystroke}</span>
    </span>
  );
}

function highlight(text: string, phrases?: string[]): string {
  if (phrases == null) {
    return text;
  }

  const lowerCasedText = text.toLowerCase();
  let returnValue = '';
  let previousIndex = 0;

  for (const phrase of phrases) {
    const nonUnderlinedText = lowerCasedText.slice(previousIndex);
    const nonUnderlinedPhraseIndex = nonUnderlinedText.indexOf(phrase.toLowerCase());
    const index = previousIndex + nonUnderlinedPhraseIndex;

    if (index !== -1) {
      const endIndex = index + phrase.length;
      const pattern = escapeRegExp(phrase);
      const regex = new RegExp(pattern, 'i');

      returnValue += text.substring(previousIndex, endIndex).replace(regex, (substring: string): string => {
        return `<span class="quick-jump__highlight">${substring}</span>`;
      });
      previousIndex = endIndex;
    }
  }

  returnValue += text.substr(previousIndex);

  return returnValue;
}

function escapeRegExp(text: string): string {
  return text.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&');
}

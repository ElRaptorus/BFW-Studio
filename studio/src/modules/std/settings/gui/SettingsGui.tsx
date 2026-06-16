import type { Bifrost } from '#bifrost/Bifrost';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import type { SettingDescriptor, Studio } from '@evil/bifrost_fw_sdk';

import {
  EVENT_SETTINGS_CHANGED,
  EVENT_SETTINGS_SCHEMA_REGISTERED,
} from '../../../../../../studio-sdk/src/contracts/internal/SettingsEvents';
import { consumePendingCategory, onCategoryNavigationRequested } from '../settingsNavigation';
import { SettingsCategoryNav } from './SettingsCategoryNav';
import { SettingsGroup } from './SettingsGroup';
import { SettingsSearch } from './SettingsSearch';

type SettingsGuiProps = {
  studio: Studio;
  onOpenJsonEditor: () => void;
};

type GroupedSettings = Map<
  string,
  {
    key: string;
    descriptor: SettingDescriptor;
    value: unknown;
  }[]
>;

function humanizeDomainSegment(segment: string): string {
  return segment.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/^./, (ch) => ch.toUpperCase());
}

function deriveCategory(key: string, descriptor: SettingDescriptor): string {
  if (descriptor.category != null) {
    return descriptor.category;
  }
  return humanizeDomainSegment(key.split('.')[0]);
}

function groupSettingsByCategory(
  schemas: Map<string, SettingDescriptor>,
  studio: Studio,
  searchQuery: string,
): GroupedSettings {
  const groups: GroupedSettings = new Map();
  const lowerQuery = searchQuery.toLowerCase();

  for (const [key, descriptor] of schemas) {
    if (descriptor.hidden) {
      continue;
    }

    if (lowerQuery !== '') {
      const matchesKey = key.toLowerCase().includes(lowerQuery);
      const matchesLabel = descriptor.label.toLowerCase().includes(lowerQuery);
      const matchesDescription = descriptor.description.toLowerCase().includes(lowerQuery);
      const matchesCategory = (descriptor.category ?? '').toLowerCase().includes(lowerQuery);
      if (!matchesKey && !matchesLabel && !matchesDescription && !matchesCategory) {
        continue;
      }
    }

    const category = deriveCategory(key, descriptor);
    let group = groups.get(category);
    if (group == null) {
      group = [];
      groups.set(category, group);
    }

    let value: unknown;
    try {
      value = studio.settings.get(key);
    } catch {
      value = descriptor.default;
    }

    group.push({ key, descriptor, value });
  }

  return groups;
}

export function SettingsGui(props: SettingsGuiProps): React.JSX.Element {
  const { onOpenJsonEditor } = props;
  const studio = props.studio as Bifrost;
  const [searchQuery, setSearchQuery] = useState('');
  const [revision, setRevision] = useState(0);
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const bodyRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const valueSub = studio.settings.on(EVENT_SETTINGS_CHANGED, () => {
      setRevision((previousRevision) => previousRevision + 1);
    });
    const schemaSub = studio.settings.on(EVENT_SETTINGS_SCHEMA_REGISTERED, () => {
      setRevision((previousRevision) => previousRevision + 1);
    });
    return () => {
      valueSub.dispose();
      schemaSub.dispose();
    };
  }, [studio]);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const schemas = useMemo(() => studio.settings.getSchemas(), [studio.settings, revision]);
  const groups = useMemo(
    () => groupSettingsByCategory(schemas, studio, searchQuery),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [schemas, studio, searchQuery, revision],
  );

  const categories = useMemo(() => Array.from(groups.keys()), [groups]);

  useEffect(() => {
    const body = bodyRef.current;
    if (body == null) {
      return;
    }

    const groupElements = body.querySelectorAll<HTMLElement>('.settings-gui__group[data-category]');
    if (groupElements.length === 0) {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        let topMostCategory: string | null = null;
        let topMostY = Infinity;

        for (const entry of entries) {
          if (!entry.isIntersecting) {
            continue;
          }
          const rect = entry.boundingClientRect;
          if (rect.top < topMostY) {
            topMostY = rect.top;
            topMostCategory = entry.target.getAttribute('data-category');
          }
        }

        if (topMostCategory != null) {
          setActiveCategory(topMostCategory);
        }
      },
      {
        root: body,
        rootMargin: '0px 0px -80% 0px',
        threshold: 0,
      },
    );

    groupElements.forEach((el) => observer.observe(el));

    return () => observer.disconnect();
  }, [groups]);

  const onCategoryClick = useCallback((category: string) => {
    const body = bodyRef.current;
    if (body == null) {
      return;
    }
    const el = body.querySelector<HTMLElement>(`[data-category="${category}"]`);
    if (el == null) {
      return;
    }

    const bodyRect = body.getBoundingClientRect();
    const elRect = el.getBoundingClientRect();
    body.scrollTo({ top: elRect.top - bodyRect.top + body.scrollTop, behavior: 'smooth' });
  }, []);

  useEffect(() => {
    const pending = consumePendingCategory();
    if (pending != null) {
      requestAnimationFrame(() => onCategoryClick(pending));
    }

    return onCategoryNavigationRequested((category) => {
      onCategoryClick(category);
    });
  }, [onCategoryClick]);

  return (
    <div className="settings-gui">
      <SettingsSearch searchQuery={searchQuery} onChange={setSearchQuery} />
      <div className="settings-gui__content">
        <SettingsCategoryNav
          categories={categories}
          activeCategory={activeCategory}
          onCategoryClick={onCategoryClick}
        />
        <div className="settings-gui__body" ref={bodyRef}>
          {groups.size === 0 && <div className="settings-gui__empty">No settings match your search.</div>}
          {Array.from(groups.entries()).map(([groupLabel, settings]) => (
            <SettingsGroup
              key={groupLabel}
              studio={studio}
              groupLabel={groupLabel}
              settings={settings}
              onOpenJsonEditor={onOpenJsonEditor}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

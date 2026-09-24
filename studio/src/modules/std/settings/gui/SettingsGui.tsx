import type { Bifrost } from '#bifrost/Bifrost';
import type { SettingsScopeTarget } from '#bifrost/contracts/SettingsScopeTypes';
import { EVENT_SETTINGS_CHANGED, EVENT_SETTINGS_SCHEMA_REGISTERED } from '#bifrost/contracts/internal/SettingsEvents';
import equal from 'fast-deep-equal';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import type { SettingDescriptor } from '@elraptorus/bfw_studio_sdk';

import { consumePendingCategory, onCategoryNavigationRequested } from '../settingsNavigation';
import { SettingsCategoryNav } from './SettingsCategoryNav';
import { SettingsGroup, type SettingsGuiEntry } from './SettingsGroup';
import { SettingsScopeBar } from './SettingsScopeBar';
import { SettingsSearch } from './SettingsSearch';

type SettingsGuiProps = {
  studio: Bifrost;
  target: SettingsScopeTarget;
  onTargetChange: (target: SettingsScopeTarget) => void;
  onOpenJsonEditor: () => void;
};

type GroupedSettings = Map<string, SettingsGuiEntry[]>;

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
  studio: Bifrost,
  searchQuery: string,
  target: SettingsScopeTarget,
): GroupedSettings {
  const groups: GroupedSettings = new Map();
  const lowerQuery = searchQuery.toLowerCase();
  const layerValues = studio.settings.getScopeValues(target);

  for (const [key, descriptor] of schemas) {
    if (descriptor.hidden) {
      continue;
    }
    if (target.scope !== 'user' && !studio.settings.isEligibleForScope(key, target.scope)) {
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

    const inspection = studio.settings.inspectForTarget(target, key);
    const definedInLayer = Object.prototype.hasOwnProperty.call(layerValues, key);
    const isModified = target.scope === 'user' ? !equal(inspection.value, descriptor.default) : definedInLayer;
    const overriddenIn = target.scope === 'user' ? formatOverridingScopes(studio, key) : null;

    group.push({
      key,
      descriptor,
      value: inspection.value,
      isModified,
      resetTooltip: target.scope === 'user' ? 'Reset to default' : 'Reset to inherited',
      overriddenIn,
    });
  }

  return groups;
}

function formatOverridingScopes(studio: Bifrost, key: string): string | null {
  const projects = studio.solution.getSolution()?.projects ?? [];
  const labels = studio.settings.listOverridingScopes(key).map((scopeTarget) => {
    if (scopeTarget.scope === 'project') {
      return projects.find((project) => project.baseUri === scopeTarget.projectBaseUri)?.name ?? 'Project';
    }
    return 'Solution';
  });
  return labels.length > 0 ? labels.join(', ') : null;
}

export function SettingsGui(props: SettingsGuiProps): React.JSX.Element {
  const { onOpenJsonEditor, target } = props;
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
    () => groupSettingsByCategory(schemas, studio, searchQuery, target),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [schemas, studio, searchQuery, revision, target],
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

  const onChange = useCallback(
    (key: string, value: unknown) => {
      void studio.settings.setInScope(target, key, value);
    },
    [studio, target],
  );

  const onReset = useCallback(
    (key: string) => {
      void studio.settings.removeFromScope(target, key);
    },
    [studio, target],
  );

  return (
    <div className="settings-gui">
      <SettingsScopeBar studio={studio} target={target} onTargetChange={props.onTargetChange} />
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
              groupLabel={groupLabel}
              settings={settings}
              onChange={onChange}
              onReset={onReset}
              onOpenJsonEditor={onOpenJsonEditor}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

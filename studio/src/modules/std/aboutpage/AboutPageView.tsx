import ProductNameHeadline from '#components/ProductNameHeadline';

import React, { useState } from 'react';

export interface AboutFact {
  label: string;
  value: string;
}

export interface AboutPluginRow {
  name: string;
  version: string;
  status: string;
}

export interface AboutPageViewProps {
  productName: string;
  releaseChannelName: string;
  identityParts: string[];
  runtimeFacts?: AboutFact[];
  computerFacts?: AboutFact[];
  editorFacts: AboutFact[];
  moduleNames: string[];
  plugins?: AboutPluginRow[];
  settings: unknown;
}

export default function AboutPageView(props: AboutPageViewProps): React.JSX.Element {
  const identityLine = props.identityParts.filter((part) => part !== '').join(' · ');
  const supportReport = buildSupportReport(props, identityLine);
  const [copyLabel, setCopyLabel] = useState('Copy support report');

  async function copySupportReport(): Promise<void> {
    try {
      await navigator.clipboard.writeText(supportReport);
      setCopyLabel('Copied');
    } catch {
      setCopyLabel('Copy failed');
    }
    window.setTimeout(() => setCopyLabel('Copy support report'), 2000);
  }

  return (
    <div className="about-page__column">
      <div>
        <ProductNameHeadline productName={props.productName} releaseChannelName={props.releaseChannelName} />
        <p className="about-page__identity">{identityLine}</p>
      </div>
      {renderFactGroup('Runtime', props.runtimeFacts)}
      {renderFactGroup('This Computer', props.computerFacts)}
      {renderFactGroup('Editor', props.editorFacts)}
      {renderModuleGroup(props.moduleNames)}
      {renderPluginGroup(props.plugins)}
      <details className="about-page__settings">
        <summary>
          <h3 className="about-page__group-label">User Settings</h3>
        </summary>
        <div className="about-page__settings-list">{renderSettings(settingRows(props.settings))}</div>
      </details>
      <div className="about-page__actions">
        <button type="button" className="btn btn-sm btn-secondary" onClick={() => void copySupportReport()}>
          {copyLabel}
        </button>
      </div>
    </div>
  );
}

function renderFactGroup(title: string, facts: AboutFact[] | undefined): React.JSX.Element | null {
  if (facts == null || facts.length === 0) {
    return null;
  }
  return (
    <section className="about-page__group">
      <h3 className="about-page__group-label">{title}</h3>
      <div className="about-page__facts">{renderFacts(facts)}</div>
    </section>
  );
}

function renderSettings(facts: AboutFact[]): React.JSX.Element[] {
  return facts.map((fact) => (
    <div className="about-page__setting" key={fact.label}>
      <span className="about-page__setting-label">{fact.label}</span>
      <span className="about-page__setting-value">{fact.value}</span>
    </div>
  ));
}

function renderFacts(facts: AboutFact[]): React.JSX.Element[] {
  return facts.map((fact) => (
    <div className="about-page__fact" key={fact.label}>
      <span className="about-page__fact-label">{fact.label}</span>
      <span className="about-page__fact-value">{fact.value}</span>
    </div>
  ));
}

function renderModuleGroup(moduleNames: string[]): React.JSX.Element | null {
  if (moduleNames.length === 0) {
    return null;
  }
  return (
    <section className="about-page__group">
      <h3 className="about-page__group-label">Loaded internal modules</h3>
      <ul className="about-page__modules">
        {moduleNames.map((moduleName) => (
          <li className="about-page__module" key={moduleName}>
            {moduleName}
          </li>
        ))}
      </ul>
    </section>
  );
}

function renderPluginGroup(plugins: AboutPluginRow[] | undefined): React.JSX.Element | null {
  if (plugins == null || plugins.length === 0) {
    return null;
  }
  return (
    <section className="about-page__group">
      <h3 className="about-page__group-label">Loaded Plugins</h3>
      <div className="about-page__facts">
        {plugins.map((plugin) => (
          <div className="about-page__fact" key={plugin.name}>
            <span className="about-page__fact-label">{plugin.name}</span>
            <span className="about-page__fact-value">
              {plugin.version} · {plugin.status}
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}

function settingRows(settings: unknown): AboutFact[] {
  if (settings == null || typeof settings !== 'object' || Array.isArray(settings)) {
    return [{ label: 'settings', value: formatSettingValue(settings) }];
  }
  return Object.keys(settings)
    .sort((left, right) => left.localeCompare(right))
    .map((key) => ({
      label: key,
      value: formatSettingValue((settings as Record<string, unknown>)[key]),
    }));
}

function formatSettingValue(value: unknown): string {
  if (typeof value === 'string') {
    return value;
  }
  if (typeof value === 'number' || typeof value === 'boolean' || value == null) {
    return String(value);
  }
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function buildSupportReport(props: AboutPageViewProps, identityLine: string): string {
  const sections = [`${props.productName}\n${identityLine}`];
  appendFactSection(sections, 'Runtime', props.runtimeFacts);
  appendFactSection(sections, 'This Computer', props.computerFacts);
  appendFactSection(sections, 'Editor', props.editorFacts);
  if (props.moduleNames.length > 0) {
    sections.push(`Loaded internal modules\n${props.moduleNames.join(', ')}`);
  }
  if (props.plugins != null && props.plugins.length > 0) {
    const rows = props.plugins.map((plugin) => `${plugin.name}: ${plugin.version} · ${plugin.status}`).join('\n');
    sections.push(`Loaded Plugins\n${rows}`);
  }
  sections.push(`User Settings\n${stringifySettings(props.settings)}`);
  return sections.join('\n\n');
}

function appendFactSection(sections: string[], title: string, facts: AboutFact[] | undefined): void {
  if (facts == null || facts.length === 0) {
    return;
  }
  sections.push(`${title}\n${facts.map((fact) => `${fact.label}: ${fact.value}`).join('\n')}`);
}

function stringifySettings(settings: unknown): string {
  try {
    return JSON.stringify(settings, null, 2);
  } catch {
    return String(settings);
  }
}

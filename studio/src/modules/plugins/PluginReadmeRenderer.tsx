import { Bifrost } from '#bifrost/Bifrost';
import { EVENT_PLUGIN_LIST_CHANGED } from '#bifrost/contracts/PluginHostTypes';
import DOMPurify from 'dompurify';
import * as fs from 'fs/promises';
import { marked } from 'marked';

import React, { useCallback, useEffect, useState, useSyncExternalStore } from 'react';

import type { EditorDocumentRendererProps, PluginInfo } from '@evil/bifrost_fw_sdk';
import { Editor, EditorContent } from '@evil/bifrost_fw_sdk';

import './plugins.scss';
import { usePluginLogo } from './usePluginLogo';

function DeprecationIcon({ message }: { message: string }): React.JSX.Element {
  return (
    <span
      className="plugin-readme-deprecation-icon ph ph-warning"
      title={message}
      data-test--plugin-readme-deprecated-icon
    />
  );
}

function MetaSection({
  author,
  homepage,
  keywords,
}: {
  author: string;
  homepage?: string;
  keywords?: string[];
}): React.JSX.Element | null {
  const handleLinkClick = useCallback((ev: React.MouseEvent, url: string) => {
    ev.preventDefault();
    import('electron').then(({ shell }) => shell.openExternal(url));
  }, []);

  const hasContent = author || homepage || (keywords && keywords.length > 0);
  if (!hasContent) {
    return null;
  }

  return (
    <div className="plugin-readme-meta" data-test--plugin-readme-meta>
      {author && (
        <div className="plugin-readme-meta__row">
          <span className="plugin-readme-meta__label">Author</span>
          <span className="plugin-readme-meta__value">{author}</span>
        </div>
      )}
      {homepage && (
        <div className="plugin-readme-meta__row">
          <span className="plugin-readme-meta__label">Website</span>
          <a
            className="plugin-readme-meta__link"
            href={homepage}
            title={homepage}
            onClick={(ev) => handleLinkClick(ev, homepage)}
            data-test--plugin-readme-website
          >
            {homepage.replace(/^https?:\/\//, '')}
          </a>
        </div>
      )}
      {keywords && keywords.length > 0 && (
        <div className="plugin-readme-meta__row">
          <span className="plugin-readme-meta__label">Tags</span>
          <div className="plugin-readme-meta__tags" data-test--plugin-readme-tags>
            {keywords.map((tag) => (
              <span key={tag} className="plugin-readme-tag">
                {tag}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function usePluginInfo(bifrost: Bifrost, pluginName: string): PluginInfo | null {
  const subscribe = useCallback(
    (onStoreChange: () => void) => {
      const sub = bifrost.plugins.on(EVENT_PLUGIN_LIST_CHANGED, onStoreChange);
      return () => sub.dispose();
    },
    [bifrost.plugins],
  );

  const getSnapshot = useCallback(
    () => bifrost.plugins.getPluginList().find((plugin) => plugin.name === pluginName) ?? null,
    [bifrost.plugins, pluginName],
  );

  return useSyncExternalStore(subscribe, getSnapshot);
}

export default function PluginReadmeRenderer(props: EditorDocumentRendererProps): React.JSX.Element {
  const bifrost = Bifrost.cast(props.studio);
  const pluginName = props.uri.replace('about:plugin-readme/', '');

  const pluginInfo = usePluginInfo(bifrost, pluginName);

  const logoDataUri = usePluginLogo(bifrost, pluginInfo?.logoPath);
  const [readmeHtml, setReadmeHtml] = useState<string | null>(null);

  useEffect(() => {
    if (!pluginInfo?.readmePath) {
      return;
    }

    let cancelled = false;
    const readmePath = pluginInfo.readmePath;

    fs.readFile(readmePath, 'utf-8')
      .then(async (md) => {
        const rawHtml = await marked.parse(md);
        const sanitizedHtml = DOMPurify.sanitize(rawHtml);
        if (!cancelled) {
          setReadmeHtml(sanitizedHtml);
        }
      })
      .catch(() => {
        // README could not be read — leave readmeHtml as null
      });

    return () => {
      cancelled = true;
    };
  }, [pluginInfo?.readmePath]);

  if (!pluginInfo) {
    return (
      <Editor>
        <EditorContent>
          <div className="plugin-readme-view plugin-readme-not-found" data-test--plugin-readme-not-found>
            Plugin not found.
          </div>
        </EditorContent>
      </Editor>
    );
  }

  const deprecationMessage = typeof pluginInfo.deprecated === 'string' ? pluginInfo.deprecated : undefined;

  return (
    <Editor>
      <EditorContent>
        <div className="plugin-readme-view" data-test--plugin-readme={pluginName}>
          <div className="plugin-readme-header">
            <div className="plugin-readme-header__left">
              {logoDataUri && (
                <img
                  className="plugin-readme-logo"
                  src={logoDataUri}
                  alt={`${pluginInfo.displayName} logo`}
                  data-test--plugin-readme-logo
                />
              )}
              <div className="plugin-readme-header__info">
                <div className="plugin-readme-header__title-row">
                  {pluginInfo.deprecated && (
                    <DeprecationIcon message={deprecationMessage ?? 'This plugin is deprecated'} />
                  )}
                  <h1>{pluginInfo.displayName}</h1>
                  <span className="plugin-readme-version">v{pluginInfo.version}</span>
                </div>
                {pluginInfo.description && <p className="plugin-readme-description">{pluginInfo.description}</p>}
                {deprecationMessage && (
                  <p className="plugin-readme-deprecation-message" data-test--plugin-readme-deprecation-message>
                    {deprecationMessage}
                  </p>
                )}
              </div>
            </div>

            <MetaSection author={pluginInfo.author} homepage={pluginInfo.homepage} keywords={pluginInfo.keywords} />
          </div>

          <div className="plugin-readme-body">
            {pluginInfo.readmePath && readmeHtml ? (
              <div
                className="plugin-readme-content"
                data-test--plugin-readme-content
                // eslint-disable-next-line @eslint-react/dom-no-dangerously-set-innerhtml -- plugin readme HTML
                dangerouslySetInnerHTML={{ __html: readmeHtml }}
              />
            ) : (
              <p className="plugin-readme-no-content" data-test--plugin-readme-no-content>
                This plugin does not provide documentation.
              </p>
            )}
          </div>
        </div>
      </EditorContent>
    </Editor>
  );
}

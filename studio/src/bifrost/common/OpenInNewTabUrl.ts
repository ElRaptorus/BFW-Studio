import { URLSearchParams } from 'url';

/**
 * FragmentUris allow you to open parts of documents ("fragments") in their own tabs.
 * The canonical example for this is a new tab to edit the documentation of a BPMN element.
 *
 *     fragment+bpmn.docs:file%3A///home/rene/Processes/routing.bpmn#!fragmentId=StartRouting
 *     └───┬──┘ └───┬───┘ └───────────────┬────────────────────────┘ └──────────┬──────────┘
 *      scheme     type           URI of the parent document             ID of the fragment
 *
 * * The recommended naming scheme for the scheme is `fragment+<document-type>.<fragment-type>`.
 * * The URI of the parent document is just that: an arbitrary URI, which can itself contain an
 *   authority, path, query, fragment, et cetera.
 * * The fragment contains a leading `!` followed by attribute-value-pairs,
 * with the `id` attribute defining the id of the fragment to load/show/edit.
 *
 */
export type OpenInNewTabUrl = {
  type: string;
  parentUri: string;
  fragmentId: string;
  data: any;
};

/**
 * Returns `true` if the given `uri` is a valid OpenInNewTabUrl.
 */
export function isUrlForOpenInNewTab(uri: string): boolean {
  if (uri == null) {
    return false;
  }

  return uri.match(/^fragment\+/) != null;
}

/**
 * Returns fragment uri for the given parameters.
 *
 * @param type The type (usually a combination of the parent's document type and the fragment's type, see above)
 * @param parentUri The parent document's URI
 * @param fragmentId The fragment's identifier inside the parent's document model
 * @param additionalData An optional object with key/value pairs to be encoded into the URI
 */
export function getUrlForOpenInNewTab(
  type: string,
  parentUri: string,
  fragmentId: string,
  additionalData: any = {},
): string {
  const data = { ...additionalData, fragmentId: fragmentId };

  const str: string[] = [];
  Object.keys(data).forEach((key: string) => {
    str.push(encodeURIComponent(key) + '=' + encodeURIComponent(data[key]));
  });

  const params = str.join('&');

  return `fragment+${type}:${escape(parentUri)}#!${params}`;
}

/**
 * Parses the given `uri` into an OpenInNewTabUrl object.
 *
 * @param uri The fragment URI to parse
 */
export function parseOpenInNewTabUrl(uri: string): OpenInNewTabUrl {
  if (uri == null) {
    throw new Error(`Could not parse fragment from uri: null`);
  }

  const parsedUri = new URL(uri);

  const type = parsedUri.protocol.replace(/^fragment\+/, '').replace(/:$/, '');
  const parentUri = unescape(parsedUri.pathname);

  const fragment = parsedUri.hash.replace(/^#!/, '');
  const parsedFragment = new URLSearchParams(fragment);

  let fragmentId: string | null = null;
  const data: any = {};
  parsedFragment.forEach((value: string, key: string) => {
    if (key === 'fragmentId') {
      fragmentId = value;
    } else {
      data[key] = value;
    }
  });

  if (fragmentId == null) {
    throw new Error(`Could not parse fragment/data from uri (fragmentId missing): ${uri}`);
  }

  return { type, parentUri, fragmentId, data };
}

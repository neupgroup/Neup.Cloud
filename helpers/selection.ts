/*
::neup.documentation::inapp-selection-helper
::title In-App Selection Helper

URL-only selected-server helpers for app navigation.

::public

Use `getSelectedServer()` to read the selected server from the `selectedServer`
query parameter.

Use `selectServer()` to add or replace the `selectedServer` query parameter on a
target URL.

::public end

::private

This module intentionally avoids cookies and browser storage. Selected-server
state is derived only from the current URL.

::private end

::end
*/

export const SELECTED_SERVER_QUERY_KEY = 'selectedServer';

function trimValue(value: string | null | undefined) {
  const next = value?.trim();
  return next ? next : null;
}

function splitHref(href: string) {
  const hashIndex = href.indexOf('#');
  const beforeHash = hashIndex === -1 ? href : href.slice(0, hashIndex);
  const hash = hashIndex === -1 ? '' : href.slice(hashIndex);
  const queryIndex = beforeHash.indexOf('?');

  return {
    basePath: queryIndex === -1 ? beforeHash : beforeHash.slice(0, queryIndex),
    query: queryIndex === -1 ? '' : beforeHash.slice(queryIndex + 1),
    hash,
  };
}

function getSearchParameters(source?: Pick<URLSearchParams, 'toString'> | string | null) {
  if (typeof source === 'string') {
    return new URLSearchParams(splitHref(source).query);
  }

  if (source?.toString) {
    return new URLSearchParams(source.toString());
  }

  if (typeof window !== 'undefined') {
    return new URLSearchParams(window.location.search);
  }

  return new URLSearchParams();
}

export function getSelectedServer(searchParams?: Pick<URLSearchParams, 'toString'> | string | null) {
  return trimValue(getSearchParameters(searchParams).get(SELECTED_SERVER_QUERY_KEY));
}

export function selectServer(href: string, selectedServerId?: string | null) {
  const nextSelectedServerId = trimValue(selectedServerId);
  if (!nextSelectedServerId) {
    return href;
  }

  const { basePath, query, hash } = splitHref(href);
  const params = new URLSearchParams(query);
  params.set(SELECTED_SERVER_QUERY_KEY, nextSelectedServerId);

  const nextQuery = params.toString();
  return `${basePath}${nextQuery ? `?${nextQuery}` : ''}${hash}`;
}

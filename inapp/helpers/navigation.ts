/*
::neup.documentation::inapp-navigation-helper
::title In-App Navigation Helper

Application-specific navigation helpers for selected-server query context.

::public

Use `withSelectedServerQuery()` when an app link should carry the active selected server.

Use `getSelectedServerId()` to read the selected server from query parameters or the browser session cache.

::public end

::private

This module owns the selected-server query parameter and browser session fallback for app routes.

::private end

::end
*/

export const SELECTED_SERVER_QUERY_KEY = 'selectedServer';

const SELECTED_SERVER_SESSION_KEY = 'selectedServer:lastKnown';

const SELECTED_SERVER_ROUTE_PREFIXES = [
  '/home',
  '/server/home',
  '/server/initialize',
  '/server/status',
  '/server/applications',
  '/server/database',
  '/server/mail',
  '/server/commands',
  '/server/firewall',
  '/server/files',
  '/server/search',
  '/server/webservices',
  '/server/system',
] as const;

type ServerSelectionCandidate = {
  id: string;
  publicIp?: string | null;
  privateIp?: string | null;
  name?: string | null;
};

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

export function getServerSelectionCandidates(value: string | null | undefined) {
  const trimmed = trimValue(value);
  if (!trimmed) {
    return [];
  }

  const candidates = new Set<string>([trimmed]);
  const addCandidate = (next: string | null | undefined) => {
    const normalized = trimValue(next);
    if (normalized) {
      candidates.add(normalized);
    }
  };

  try {
    const parsed = new URL(trimmed);
    addCandidate(parsed.hostname);
  } catch {
    if (/^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed) === false && /[/:]/.test(trimmed)) {
      try {
        const parsed = new URL(`ssh://${trimmed}`);
        addCandidate(parsed.hostname);
      } catch {
        // Keep the raw candidate when a URL-like value cannot be parsed.
      }
    }
  }

  addCandidate(trimmed.replace(/^[a-z][a-z0-9+.-]*:\/\//i, '').split('/')[0]?.replace(/:\d+$/, ''));

  return Array.from(candidates);
}

export function resolveSelectedServerValue<T extends ServerSelectionCandidate>(
  value: string | null | undefined,
  servers: T[],
) {
  const candidates = getServerSelectionCandidates(value);
  if (candidates.length === 0) {
    return null;
  }

  const matchedServer = servers.find((server) =>
    candidates.some(
      (candidate) =>
        server.id === candidate ||
        server.publicIp === candidate ||
        server.privateIp === candidate ||
        server.name === candidate,
    ),
  );

  return matchedServer?.id ?? candidates[0];
}

export function getSelectedServerFromParams(searchParams?: Pick<URLSearchParams, 'toString'> | string | null) {
  return trimValue(getSearchParameters(searchParams).get(SELECTED_SERVER_QUERY_KEY));
}

export function getCachedSelectedServerId() {
  if (typeof window === 'undefined') {
    return null;
  }

  return trimValue(window.sessionStorage.getItem(SELECTED_SERVER_SESSION_KEY));
}

export function cacheSelectedServerId(serverId: string | null | undefined) {
  if (typeof window === 'undefined') {
    return;
  }

  const next = trimValue(serverId);
  if (next) {
    window.sessionStorage.setItem(SELECTED_SERVER_SESSION_KEY, next);
  } else {
    window.sessionStorage.removeItem(SELECTED_SERVER_SESSION_KEY);
  }
}

export function getSelectedServerId(searchParams?: Pick<URLSearchParams, 'toString'> | string | null) {
  return getSelectedServerFromParams(searchParams) ?? getCachedSelectedServerId();
}

export function shouldPreserveSelectedServer(pathname: string | null | undefined) {
  if (!pathname) {
    return false;
  }

  return SELECTED_SERVER_ROUTE_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

export function withSelectedServerQuery(href: string, selectedServerId?: string | null) {
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

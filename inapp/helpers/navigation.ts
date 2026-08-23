/*
::neup.documentation::inapp-navigation-helper
::title In-App Navigation Helper

Application-specific navigation helpers for selected-server query context.

::public

Use `withSelectedServerQuery()` when an app link should carry the active selected server.

Use `getSelectedServerId()` to read the selected server from the URL query parameter.

::public end

::private

This module owns selected-server route matching and compatibility wrappers for app routes.

::private end

::end
*/

import {
  getSelectedServer,
  selectServer,
} from '@/inapp/helpers/selection';

const SELECTED_SERVER_ROUTE_PREFIXES = [
  '/home',
  '/server/home',
  '/server/initialize',
  '/server/status',
  '/server/processes',
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
  return getSelectedServer(searchParams);
}

export function getSelectedServerId(searchParams?: Pick<URLSearchParams, 'toString'> | string | null) {
  return getSelectedServer(searchParams);
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
  return selectServer(href, selectedServerId);
}

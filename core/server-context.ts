export const SELECTED_SERVER_QUERY_KEY = 'selectedServer';
const SELECTED_SERVER_SESSION_KEY = 'selectedServer:lastKnown';

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
        // Ignore invalid URL-like values and keep the raw candidate.
      }
    }
  }

  addCandidate(trimmed.replace(/^[a-z][a-z0-9+.-]*:\/\//i, '').split('/')[0]?.replace(/:\d+$/, ''));

  return Array.from(candidates);
}

export function resolveSelectedServerValue<T extends ServerSelectionCandidate>(
  value: string | null | undefined,
  servers: T[]
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
        server.name === candidate
    )
  );

  return matchedServer?.id ?? candidates[0];
}

export function getSelectedServerFromParams(
  searchParams?: Pick<URLSearchParams, 'get'> | null
) {
  return trimValue(searchParams?.get(SELECTED_SERVER_QUERY_KEY));
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

export function getSelectedServerId(searchParams?: Pick<URLSearchParams, 'get'> | null) {
  return getSelectedServerFromParams(searchParams) ?? getCachedSelectedServerId();
}

export function withSelectedServerQuery(
  href: string,
  selectedServerId?: string | null
) {
  const nextSelectedServer = trimValue(selectedServerId);
  if (!nextSelectedServer) {
    return href;
  }

  const [pathWithQuery, hash = ''] = href.split('#');
  const [path, query = ''] = pathWithQuery.split('?');
  const params = new URLSearchParams(query);
  params.set(SELECTED_SERVER_QUERY_KEY, nextSelectedServer);

  const nextQuery = params.toString();
  return `${path}${nextQuery ? `?${nextQuery}` : ''}${hash ? `#${hash}` : ''}`;
}

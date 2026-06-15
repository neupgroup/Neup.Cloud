export const SELECTED_SERVER_QUERY_KEY = 'selectedServer';
const SELECTED_SERVER_SESSION_KEY = 'selectedServer:lastKnown';

function trimValue(value: string | null | undefined) {
  const next = value?.trim();
  return next ? next : null;
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

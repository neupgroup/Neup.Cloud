'use client';

/*
::neup.documentation::inapp-hooks-use-selected-server
::title Selected Server Hooks

Provides client hooks for reading and preserving the selected server query context inside the app.

::public

Use `useSelectedServerId()` to read the selected server ID.

Use `useSelectedServerHref()` or `useSelectedServerUrlUpdater()` when links should preserve the selected server.

::public end

::private

These hooks live in `inapp` because selected-server navigation is application context. Generic parameter mutation remains in `core/helpers/link`.

::private end

::end
*/

import { useEffect, useMemo } from 'react';
import { usePathname } from 'next/navigation';
import {
  cacheSelectedServerId,
  getSelectedServerId,
  getSelectedServerFromParams,
  withSelectedServerQuery,
} from '@/inapp/helpers/navigation';

export { withSelectedServerQuery } from '@/inapp/helpers/navigation';

function getCurrentSearch() {
  return typeof window === 'undefined' ? '' : window.location.search;
}

export function useSelectedServerId() {
  const pathname = usePathname();

  const selectedServerId = useMemo(() => getSelectedServerId(getCurrentSearch()), [pathname]);

  useEffect(() => {
    const selectedServerFromUrl = getSelectedServerFromParams(getCurrentSearch());
    if (selectedServerFromUrl) {
      cacheSelectedServerId(selectedServerFromUrl);
    }
  }, [pathname]);

  return selectedServerId;
}

export function useSelectedServerHref() {
  const selectedServerId = useSelectedServerId();

  return (href: string) => withSelectedServerQuery(href, selectedServerId ?? getSelectedServerFromParams(getCurrentSearch()));
}

export function useSelectedServerUrlUpdater() {
  const pathname = usePathname();
  const selectedServerId = useSelectedServerId();

  return (nextSelectedServerId: string | null | undefined) => {
    const search = getCurrentSearch();
    return withSelectedServerQuery(
      `${pathname}${search}`,
      nextSelectedServerId ?? selectedServerId
    );
  };
}

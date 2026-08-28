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

import { usePathname, useSearchParams } from 'next/navigation';
import { getSelectedServer, selectServer } from '@/inapp/helpers/selection';

export { selectServer as withSelectedServerQuery } from '@/inapp/helpers/selection';

function getCurrentSearch() {
  return typeof window === 'undefined' ? '' : window.location.search;
}

export function useSelectedServerId() {
  const searchParams = useSearchParams();
  return getSelectedServer(searchParams);
}

export function useSelectedServerHref() {
  const selectedServerId = useSelectedServerId();

  return (href: string) => selectServer(href, selectedServerId);
}

export function useSelectedServerUrlUpdater() {
  const pathname = usePathname();
  const selectedServerId = useSelectedServerId();

  return (nextSelectedServerId: string | null | undefined) => {
    const search = getCurrentSearch();
    return selectServer(
      `${pathname}${search}`,
      nextSelectedServerId ?? selectedServerId
    );
  };
}

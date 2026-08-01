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

These hooks live in `inapp` because they are application navigation helpers, while the query parsing remains in `core/server-context`.

::private end

::end
*/

import { useEffect, useMemo } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import {
  cacheSelectedServerId,
  getSelectedServerId,
  getSelectedServerFromParams,
  withSelectedServerQuery,
} from '@/core/server-context';

export function useSelectedServerId() {
  const searchParams = useSearchParams();

  const selectedServerId = useMemo(() => getSelectedServerId(searchParams), [searchParams]);

  useEffect(() => {
    const selectedServerFromUrl = getSelectedServerFromParams(searchParams);
    if (selectedServerFromUrl) {
      cacheSelectedServerId(selectedServerFromUrl);
    }
  }, [searchParams]);

  return selectedServerId;
}

export function useSelectedServerHref() {
  const searchParams = useSearchParams();
  const selectedServerId = useSelectedServerId();

  return (href: string) => withSelectedServerQuery(href, selectedServerId ?? getSelectedServerFromParams(searchParams));
}

export function useSelectedServerUrlUpdater() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const selectedServerId = useSelectedServerId();

  return (nextSelectedServerId: string | null | undefined) =>
    withSelectedServerQuery(
      `${pathname}${searchParams.toString() ? `?${searchParams.toString()}` : ''}`,
      nextSelectedServerId ?? selectedServerId
    );
}

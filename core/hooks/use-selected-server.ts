'use client';

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

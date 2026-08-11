'use client';

import { useEffect } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import {
  cacheSelectedServerId,
  getCachedSelectedServerId,
  getSelectedServerFromParams,
  shouldPreserveSelectedServer,
  withSelectedServerQuery,
} from '@/inapp/helpers/navigation';

export function ServerQueryPreserver() {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const selectedServerId = getSelectedServerFromParams(searchParams);
    if (selectedServerId) {
      cacheSelectedServerId(selectedServerId);
    }
  }, [searchParams]);

  useEffect(() => {
    if (!shouldPreserveSelectedServer(pathname)) {
      return;
    }

    const selectedServerId = getSelectedServerFromParams(searchParams) ?? getCachedSelectedServerId();
    if (!selectedServerId) {
      return;
    }

    if (getSelectedServerFromParams(searchParams)) {
      return;
    }

    const nextUrl = withSelectedServerQuery(
      `${pathname}${searchParams.toString() ? `?${searchParams.toString()}` : ''}`,
      selectedServerId
    );

    router.replace(nextUrl, { scroll: false });
  }, [pathname, router, searchParams]);

  return null;
}

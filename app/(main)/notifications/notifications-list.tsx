'use client';

/*
::neup.documentation::notifications-list
::title Notifications List

::public

Displays notifications and loads the next page when the user reaches the end
of the list.

::public end

::end
*/

import { useEffect, useRef, useState } from 'react';
import { ChevronRight, Loader2, MessageSquareWarning } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import type { NotificationRecord } from '@/logica/notification';
import { loadMoreNotifications } from './actions';

const TARGETS = [
  { prefix: 'site.', href: 'https://neupgroup.com/sites' },
  { prefix: 'account.', href: 'https://neupgroup.com/account' },
  { prefix: 'neupid.', href: 'https://neupgroup.com/account' },
  { prefix: 'estate.', href: 'https://neupgroup.com/estate' },
  { prefix: 'drive.', href: 'https://neupgroup.com/drive' },
  { prefix: 'cloud.', href: 'https://neupgroup.com/cloud' },
] as const;

function hrefFor(notification: NotificationRecord) {
  const detail = notification.detail && typeof notification.detail === 'object' ? notification.detail as { action?: unknown; application?: unknown } : null;
  const action = typeof notification.action === 'string' ? notification.action : typeof detail?.action === 'string' ? detail.action : typeof detail?.application === 'string' ? detail.application : null;
  const normalized = action?.trim().toLowerCase();
  if (!normalized) return null;
  return TARGETS.find(({ prefix }) => normalized === prefix.slice(0, -1) || normalized.startsWith(prefix))?.href ?? null;
}

function NotificationItem({ notification }: { notification: NotificationRecord }) {
  const date = new Date(notification.createdAt);
  const dateLabel = Number.isNaN(date.getTime()) ? notification.createdAt : formatDistanceToNow(date, { addSuffix: true });
  const content = <>
    <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-muted-foreground/15"><MessageSquareWarning className="h-5 w-5 text-muted-foreground" strokeWidth={1.8} /></div>
    <div className="flex min-w-0 flex-1 items-center gap-[1.05rem]"><div className="min-w-0 flex-1 space-y-1"><h3 className="truncate text-[0.95rem] font-semibold tracking-tight">{notification.title || notification.message || notification.type}</h3><time className="block text-[0.8rem] text-muted-foreground" dateTime={notification.createdAt}>{dateLabel}</time></div><ChevronRight className="h-[1.3rem] w-[1.3rem] shrink-0 text-muted-foreground" strokeWidth={1.8} /></div>
  </>;
  const className = 'flex items-center gap-4 px-4 py-4 transition-colors hover:bg-muted/30';
  const href = hrefFor(notification);
  return href ? <a href={href} className={className}>{content}</a> : <article className={className}>{content}</article>;
}

export function NotificationsList({ initialNotifications }: { initialNotifications: NotificationRecord[] }) {
  const [notifications, setNotifications] = useState(initialNotifications);
  const [hasMore, setHasMore] = useState(initialNotifications.length === 20);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel || !hasMore) return;
    const observer = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting || isLoading) return;
      setIsLoading(true);
      void loadMoreNotifications(notifications.length).then((result) => {
        if (result.error) setError(result.error);
        else { setNotifications((current) => [...current, ...result.notifications]); setHasMore(result.hasMore); setError(null); }
      }).finally(() => setIsLoading(false));
    }, { rootMargin: '320px' });
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hasMore, isLoading, notifications.length]);

  return <>
    <div className="divide-y divide-border/80">{notifications.map((notification) => <NotificationItem key={notification.id} notification={notification} />)}</div>
    <div ref={sentinelRef} className="flex min-h-12 items-center justify-center px-4 py-3 text-sm text-muted-foreground" aria-live="polite">
      {isLoading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Loading more notifications…</> : error || (hasMore ? 'Scroll for more' : null)}
    </div>
  </>;
}

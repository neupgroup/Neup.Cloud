/*
::neup.documentation::notifications-page
::title Notifications Page

::public

Renders the account notifications center at `/notifications`.

::public end

::end
*/

import { AlertCircle, CheckCheck, ChevronRight, MessageSquareWarning } from 'lucide-react';
import type { Metadata } from 'next';
import { Card, CardContent } from '@/components/ui/card';
import { PageTitle } from '@/components/page-header';
import logica from '@/logica';
import { getCookie } from '@/core/helpers/cookie';
import type { NotificationRecord } from '@/logica/notification';
import { formatDistanceToNow } from 'date-fns';

export const metadata: Metadata = {
  title: 'Notifications, Neup.Cloud',
};

function formatNotificationDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : formatDistanceToNow(date, { addSuffix: true });
}

const NOTIFICATION_APP_TARGETS = [
  { prefix: 'site.', href: 'https://neupgroup.com/sites' },
  { prefix: 'account.', href: 'https://neupgroup.com/account' },
  { prefix: 'neupid.', href: 'https://neupgroup.com/account' },
  { prefix: 'estate.', href: 'https://neupgroup.com/estate' },
  { prefix: 'drive.', href: 'https://neupgroup.com/drive' },
  { prefix: 'cloud.', href: 'https://neupgroup.com/cloud' },
] as const;

function getNotificationAppHref(notification: NotificationRecord) {
  const detail = notification.detail && typeof notification.detail === 'object'
    ? notification.detail as { action?: unknown; application?: unknown }
    : null;
  const action = typeof notification.action === 'string'
    ? notification.action
    : typeof detail?.action === 'string'
      ? detail.action
      : typeof detail?.application === 'string'
        ? detail.application
        : null;
  const normalizedAction = action?.trim().toLowerCase();
  if (!normalizedAction) return null;

  return NOTIFICATION_APP_TARGETS.find(({ prefix }) => {
    const appName = prefix.slice(0, -1);
    return normalizedAction === appName || normalizedAction.startsWith(prefix);
  })?.href ?? null;
}

function NotificationItem({ notification }: { notification: NotificationRecord }) {
  const href = getNotificationAppHref(notification);
  const className = 'flex items-center gap-4 px-4 py-4 transition-colors hover:bg-muted/30';
  const content = (
    <>
      <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-muted-foreground/15">
        <MessageSquareWarning className="h-5 w-5 text-muted-foreground" strokeWidth={1.8} />
      </div>
      <div className="flex min-w-0 flex-1 items-center gap-[1.05rem]">
        <div className="min-w-0 flex-1 space-y-1">
          <h3 className="truncate text-[0.95rem] font-semibold tracking-tight">
            {notification.title || notification.message || notification.type}
          </h3>
          <time className="block text-[0.8rem] text-muted-foreground" dateTime={notification.createdAt}>
            {formatNotificationDate(notification.createdAt)}
          </time>
        </div>
        <ChevronRight className="h-[1.3rem] w-[1.3rem] shrink-0 text-muted-foreground" strokeWidth={1.8} />
      </div>
    </>
  );

  return href ? (
    <a href={href} className={className}>
      {content}
    </a>
  ) : (
    <article className={className}>{content}</article>
  );
}

export default async function NotificationsPage() {
  let notifications: NotificationRecord[] = [];
  let loadError: string | null = null;

  try {
    const authAccountToken = await getCookie('auth_account');

    if (!authAccountToken) {
      throw new Error('No authenticated account was found.');
    }

    const authentication = await logica.account.auth.verify(authAccountToken);
    const accountId = authentication.valid && typeof authentication.payload.aid === 'string'
      ? authentication.payload.aid.trim()
      : '';

    if (!accountId) {
      throw new Error('The authenticated cookie does not contain an account id.');
    }

    const response = await logica
      .notification({
        application: process.env.NEUP_APP_ID,
        appsecret: process.env.NEUP_APP_SECRET,
      })
      .wildcard({ accountId })
      .get();

    if (!response.ok) {
      throw new Error(`Notifications request failed with status ${response.status}.`);
    }

    if (!response.body?.success) {
      throw new Error(response.body?.error_description || response.body?.error || 'Unable to load notifications.');
    }

    notifications = response.body.data;
  } catch (error) {
    loadError = error instanceof Error ? error.message : 'Unable to load notifications.';
  }

  return (
    <div className="grid gap-8">
      <PageTitle
        title="Notifications"
        description="Stay up to date with activity across your Neup.Cloud account."
      />

      <Card className="overflow-hidden rounded-2xl border-border/80 shadow-sm">
        <CardContent className="p-0">
          {loadError ? (
            <div className="flex min-h-48 flex-col items-center justify-center gap-3 rounded-lg border border-destructive/30 bg-destructive/5 px-6 py-10 text-center">
              <AlertCircle className="h-6 w-6 text-destructive" />
              <div className="space-y-1">
                <p className="font-semibold">Notifications are unavailable</p>
                <p className="text-sm text-muted-foreground">{loadError}</p>
              </div>
            </div>
          ) : notifications.length === 0 ? (
            <div className="flex min-h-48 flex-col items-center justify-center gap-3 rounded-lg border border-dashed px-6 py-10 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
                <CheckCheck className="h-6 w-6 text-muted-foreground" />
              </div>
              <div className="space-y-1">
                <p className="font-semibold">You&apos;re all caught up</p>
                <p className="text-sm text-muted-foreground">
                  New account and infrastructure updates will appear here.
                </p>
              </div>
            </div>
          ) : (
            <div className="divide-y divide-border/80">
              {notifications.map((notification) => (
                <NotificationItem key={notification.id} notification={notification} />
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

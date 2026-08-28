/*
::neup.documentation::notifications-page
::title Notifications Page

::public

Renders the account notifications center at `/notifications`.

::public end

::end
*/

import { AlertCircle, CheckCheck } from 'lucide-react';
import type { Metadata } from 'next';
import { Card, CardContent } from '@/component/ui/card';
import { PageTitle } from '@/components/page-header';
import logica from '@/logica';
import { getCookie } from '@/core/helpers/cookie';
import type { NotificationRecord } from '@/logica/notification';
import { getAccountNotifications } from '@/services/notifications/notifications-service';
import { NotificationsList } from './notifications-list';

export const metadata: Metadata = {
  title: 'Notifications, Neup.Cloud',
};

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

    notifications = await getAccountNotifications(accountId);
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
          ) : <NotificationsList initialNotifications={notifications} />}
        </CardContent>
      </Card>
    </div>
  );
}

/*
::neup.documentation::notifications-page
::title Notifications Page

::public

Renders the account notifications center at `/notifications`.

::public end

::end
*/

import { Bell, CheckCheck } from 'lucide-react';
import type { Metadata } from 'next';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PageTitle } from '@/components/page-header';

export const metadata: Metadata = {
  title: 'Notifications, Neup.Cloud',
};

export default function NotificationsPage() {
  return (
    <div className="grid gap-8">
      <PageTitle
        title="Notifications"
        description="Stay up to date with activity across your Neup.Cloud account."
      />

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-xl font-headline">
            <Bell className="h-5 w-5 text-muted-foreground" />
            Recent notifications
          </CardTitle>
        </CardHeader>
        <CardContent>
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
        </CardContent>
      </Card>
    </div>
  );
}

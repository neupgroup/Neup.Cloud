/*
::neup.documentation::main-logger-errors-page
::title Logger Errors Page

::public

Displays stored logger activity with the `error` type.

::public end

::end
*/

import type { Metadata } from 'next';
import Link from 'next/link';
import { AlertTriangle, List } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

import { PageTitle } from '@/components/page-header';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { getErrorLoggerActivities } from '@/services/logger/logger-service';

export const metadata: Metadata = {
  title: 'Logger Errors, Neup.Cloud',
};

function formatData(data: unknown) {
  try {
    return JSON.stringify(data, null, 2);
  } catch {
    return String(data);
  }
}

export default async function LoggerErrorsPage() {
  const activities = await getErrorLoggerActivities();

  return (
    <div className="grid gap-8">
      <PageTitle
        title={(
          <span className="flex items-center gap-3">
            <AlertTriangle className="h-8 w-8 text-destructive" />
            Logger Errors
          </span>
        )}
        description="Error events received from external applications."
      >
        <Button variant="outline" asChild>
          <Link href="/logger">
            <List className="mr-2 h-4 w-4" />
            View All Logs
          </Link>
        </Button>
      </PageTitle>

      <Card>
        <CardHeader>
          <CardTitle>Error Activity</CardTitle>
          <CardDescription>All stored error events ordered by newest first.</CardDescription>
        </CardHeader>
        <CardContent>
          {activities.length === 0 ? (
            <p className="text-sm text-muted-foreground">No logger errors have been recorded yet.</p>
          ) : (
            <div className="space-y-4">
              {activities.map((activity, index) => (
                <div key={activity.id} className="space-y-3">
                  <div className="flex flex-col gap-3 rounded-lg border p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="font-semibold">{activity.project.name}</p>
                        <p className="text-sm text-muted-foreground">
                          {formatDistanceToNow(new Date(activity.loggedOn), { addSuffix: true })}
                        </p>
                      </div>
                      <Badge variant="destructive">{activity.type}</Badge>
                    </div>
                    <ScrollArea className="max-h-72 rounded-md border bg-muted/20 p-3">
                      <pre className="text-xs">{formatData(activity.data)}</pre>
                    </ScrollArea>
                  </div>
                  {index < activities.length - 1 ? <Separator /> : null}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

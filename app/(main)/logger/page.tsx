/*
::neup.documentation::main-logger-page
::title Logger Activity Page

::public

Displays the most recent logger activity stored from external applications.

::public end

::end
*/

import type { Metadata } from 'next';
import Link from 'next/link';
import { Activity, AlertTriangle, ChevronRight } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

import { PageTitle } from '@/components/page-header';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { getAllLoggerActivities } from '@/services/logger/logger-service';

export const metadata: Metadata = {
  title: 'Logger, Neup.Cloud',
};

function formatData(data: unknown) {
  try {
    return JSON.stringify(data, null, 2);
  } catch {
    return String(data);
  }
}

export default async function LoggerPage() {
  const activities = await getAllLoggerActivities();

  return (
    <div className="grid gap-8">
      <PageTitle
        title={(
          <span className="flex items-center gap-3">
            <Activity className="h-8 w-8 text-primary" />
            Logger
          </span>
        )}
        description="Incoming activity from external applications."
      >
        <Button variant="outline" asChild>
          <Link href="/logger/errors">
            <AlertTriangle className="mr-2 h-4 w-4" />
            View Errors
          </Link>
        </Button>
      </PageTitle>

      {activities.length === 0 ? (
        <p className="text-sm text-muted-foreground">No logger activity has been recorded yet.</p>
      ) : (
        <div className="space-y-4">
          {activities.map((activity, index) => (
            <div key={activity.id} className="space-y-3">
              <details className="group rounded-lg border">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 p-4">
                  <div className="flex min-w-0 items-center gap-3">
                    <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-90" />
                    <p className="truncate text-sm font-medium">
                      Type: <span className="font-semibold">{activity.type ?? 'undefined'}</span>
                    </p>
                  </div>
                  <p className="shrink-0 text-sm text-muted-foreground">
                    {formatDistanceToNow(new Date(activity.loggedOn), { addSuffix: true })}
                  </p>
                </summary>
                <div className="px-4 pb-4">
                  <div className="mb-3 flex items-center gap-2">
                    <span className="text-sm font-semibold">{activity.project.name}</span>
                    <Badge variant={activity.type === 'error' ? 'destructive' : 'secondary'}>
                      {activity.type ?? 'undefined'}
                    </Badge>
                  </div>
                  <ScrollArea className="max-h-72 rounded-md border bg-muted/20 p-3">
                    <pre className="text-xs">{formatData(activity.data)}</pre>
                  </ScrollArea>
                </div>
              </details>
              {index < activities.length - 1 ? <Separator /> : null}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

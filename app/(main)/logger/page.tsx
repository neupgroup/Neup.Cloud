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
import { Activity, AlertTriangle, ChevronLeft, ChevronRight } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

import { PageTitle } from '@/components/page-header';
import { Badge } from '#/components/ui/badge';
import { Button } from '#/components/ui/button';
import { ScrollArea } from '#/components/ui/scroll-area';
import { getLoggerProjectRecords } from '@/services/logger/logger-service';

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

export default async function LoggerPage({
  searchParams,
}: {
  searchParams?: Promise<{ page?: string }>;
}) {
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const projects = await getLoggerProjectRecords();

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
        <Button type="outlined" asChild>
          <Link href="/logger/errors">
            <AlertTriangle className="mr-2 h-4 w-4" />
            View Errors
          </Link>
        </Button>
      </PageTitle>

      {projects.length === 0 ? (
        <p className="text-sm text-muted-foreground">No logger projects have been recorded yet.</p>
      ) : (
        <div className="w-full overflow-hidden rounded-lg border divide-y">
          {projects.map((project) => (
            <Link key={project.id} href={`/logger/logs?project=${encodeURIComponent(project.id)}`} className="flex items-center justify-between p-4 hover:bg-muted/50">
              <div><p className="font-semibold">{project.name}</p><p className="text-sm text-muted-foreground">{project.slug}</p></div><ChevronRight className="h-4 w-4" />
            </Link>
          ))}
        </div>
      )}

    </div>
  );
}

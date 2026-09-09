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
import { Activity, ChevronRight, Plus } from 'lucide-react';

import { PageTitle } from '@/components/page-header';
import { Card, CardContent } from '#/components/ui/card';
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
      />

      <div className="divide-y overflow-hidden rounded-lg border">
        <Link href="/logger/new" className="block first:rounded-t-lg last:rounded-b-lg">
          <Card className="rounded-none border-0 transition-colors hover:bg-muted/30">
            <CardContent className="flex min-h-20 items-center justify-between p-4">
              <div className="flex items-center gap-3"><Plus className="h-5 w-5 text-primary" /><div><p className="font-semibold">New project</p><p className="text-sm text-muted-foreground">Create a logger project and configure its validation rules.</p></div></div>
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            </CardContent>
          </Card>
        </Link>
        {projects.map((project) => (
          <Link key={project.id} href={`/logger/logs?project=${encodeURIComponent(project.id)}`} className="block first:rounded-t-lg last:rounded-b-lg">
            <Card className="rounded-none border-0 transition-colors hover:bg-muted/30">
              <CardContent className="flex min-h-20 items-center justify-between p-4">
                <div><p className="font-semibold">{project.name}</p><p className="text-sm text-muted-foreground">{project.slug}</p></div>
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              </CardContent>
            </Card>
          </Link>
        ))}
        {projects.length === 0 && <p className="bg-background p-4 text-sm text-muted-foreground">No logger projects have been recorded yet.</p>}
      </div>

    </div>
  );
}

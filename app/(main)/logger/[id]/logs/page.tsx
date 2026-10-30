import Link from 'next/link';
import { PageTitle } from '@/components/page-header';
import { Button } from '@neup/components/ui/button';
import { getProjectLoggerActivityRecords } from '@/services/logger/logger-service';
import { LoggerLogEntry } from './log-entry';

export default async function LoggerProjectLogs({ params }: { params: Promise<{ id: string }> }) {
  const { id: projectId } = await params;
  const { activities } = await getProjectLoggerActivityRecords(projectId);
  const title = 'Project logs';
  const description = 'Activity received for this logger project.';
  return (
    <div className="grid min-w-0 gap-6">
      <PageTitle title={title} description={description}>
        <Button variant="outlined" asChild><Link href="/logger">All projects</Link></Button>
      </PageTitle>
      <div className="grid min-w-0 w-full divide-y overflow-hidden rounded-lg border">
        {activities.map((activity) => (
          <article key={activity.id} className="min-w-0 p-4">
            <div className="mb-2 flex min-w-0 flex-wrap items-center justify-between gap-x-4 gap-y-1 text-sm">
              <span className="font-semibold">{activity.type ?? 'log'}</span>
              <time className="text-muted-foreground">{new Date(activity.loggedOn).toLocaleString()}</time>
            </div>
            <LoggerLogEntry data={activity.data} />
          </article>
        ))}
        {activities.length === 0 && <p className="p-4 text-sm text-muted-foreground">No logs found.</p>}
      </div>
    </div>
  );
}

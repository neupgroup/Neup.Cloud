import { PageTitle } from '@/components/page-header';
import { getProjectLoggerActivityRecords } from '@/services/logger/logger-service';
import { LoggerLogEntry } from './log-entry';
import { differenceInDays, differenceInHours, format, formatDistanceToNow } from 'date-fns';

// Formats a logger timestamp with the same relative and absolute rules as command logs.
function formatLogDate(loggedOn: Date | string) {
  const date = new Date(loggedOn);
  const now = new Date();
  if (differenceInHours(now, date) < 24) return formatDistanceToNow(date, { addSuffix: true });
  if (differenceInDays(now, date) < 7) return format(date, 'EEE, MMM d HH:mm');
  return format(date, 'MMM d, yyyy HH:mm');
}

export default async function LoggerProjectLogs({ params }: { params: Promise<{ id: string }> }) {
  const { id: projectId } = await params;
  const { activities } = await getProjectLoggerActivityRecords(projectId);
  const title = 'Project logs';
  const description = 'Activity received for this logger project.';
  return (
    <div className="grid min-w-0 gap-6">
      <PageTitle title={title} description={description} />
      <div className="grid min-w-0 w-full divide-y overflow-hidden rounded-lg border">
        {activities.map((activity) => (
          <div key={activity.id} className="min-w-0 p-4">
            <LoggerLogEntry
              data={activity.data}
              title={activity.type ?? 'log'}
              loggedOn={formatLogDate(activity.loggedOn)}
            />
          </div>
        ))}
        {activities.length === 0 && <p className="p-4 text-sm text-muted-foreground">No logs found.</p>}
      </div>
    </div>
  );
}

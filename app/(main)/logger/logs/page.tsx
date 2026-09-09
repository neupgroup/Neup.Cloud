import Link from 'next/link';
import { notFound } from 'next/navigation';
import { PageTitle } from '@/components/page-header';
import { Button } from '#/components/ui/button';
import { getFilteredLoggerActivityRecords, getProjectLoggerActivityRecords } from '@/services/logger/logger-service';

export default async function LoggerProjectLogs({ searchParams }: { searchParams: Promise<{ project?: string; type?: string }> }) {
  const { project: projectId, type } = await searchParams;
  if (!projectId && type !== 'error') notFound();
  const { activities } = projectId ? await getProjectLoggerActivityRecords(projectId) : await getFilteredLoggerActivityRecords(type);
  const title = type === 'error' ? 'Logger errors' : 'Project logs';
  const description = type === 'error' ? 'Error activity received from external applications.' : 'Activity received for this logger project.';
  return <div className="grid gap-6"><PageTitle title={title} description={description}><Button type="outlined" asChild><Link href="/logger">All projects</Link></Button></PageTitle><div className="divide-y rounded-lg border">{activities.map((activity) => <div key={activity.id} className="p-4"><div className="mb-2 flex justify-between text-sm"><span className="font-semibold">{activity.type ?? 'log'}</span><span className="text-muted-foreground">{new Date(activity.loggedOn).toLocaleString()}</span></div><pre className="overflow-auto rounded bg-muted/30 p-3 text-xs">{JSON.stringify(activity.data, null, 2)}</pre></div>)}{activities.length === 0 && <p className="p-4 text-sm text-muted-foreground">No logs found.</p>}</div></div>;
}

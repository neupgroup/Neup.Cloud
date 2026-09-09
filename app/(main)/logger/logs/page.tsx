import Link from 'next/link';
import { notFound } from 'next/navigation';
import { PageTitle } from '@/components/page-header';
import { Button } from '#/components/ui/button';
import { getProjectLoggerActivityRecords } from '@/services/logger/logger-service';

export default async function LoggerProjectLogs({ searchParams }: { searchParams: Promise<{ project?: string }> }) {
  const projectId = (await searchParams).project;
  if (!projectId) notFound();
  const { activities } = await getProjectLoggerActivityRecords(projectId);
  return <div className="grid gap-6"><PageTitle title="Project logs" description="Activity received for this logger project."><Button type="outlined" asChild><Link href="/logger">All projects</Link></Button></PageTitle><div className="divide-y rounded-lg border">{activities.map((activity) => <div key={activity.id} className="p-4"><div className="mb-2 flex justify-between text-sm"><span className="font-semibold">{activity.type ?? 'log'}</span><span className="text-muted-foreground">{new Date(activity.loggedOn).toLocaleString()}</span></div><pre className="overflow-auto rounded bg-muted/30 p-3 text-xs">{JSON.stringify(activity.data, null, 2)}</pre></div>)}{activities.length === 0 && <p className="p-4 text-sm text-muted-foreground">No logs for this project.</p>}</div></div>;
}

import { AppWindow } from 'lucide-react';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { PageTitleBack } from '@/components/page-header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { getApplicationDetailPageData } from '@/services/server/applications/service';

import { SupervisorOnlyActions } from './supervisor-only-actions';
import { StatusDashboard } from './status-dashboard';
import { GitHubSection } from './github-section';
import { SystemSection } from './system-section';
import { DeploymentActionsCard } from './deployment-actions-card';
import { ApplicationActions } from './application-actions';
import { ApplicationLifecycleWrapper } from './application-lifecycle-wrapper';
import { RunningInSection } from './running-in-section';

function getSupervisorBadgeClasses(state: string) {
  const normalizedState = state.toUpperCase();
  if (normalizedState === 'RUNNING') return 'border-green-500/20 bg-green-500/10 text-green-700';
  if (normalizedState === 'FATAL' || normalizedState === 'BACKOFF') return 'border-orange-500/20 bg-orange-500/10 text-orange-700';
  if (normalizedState === 'STOPPED' || normalizedState === 'EXITED') return 'border-red-500/20 bg-red-500/10 text-red-700';
  return 'border-slate-500/20 bg-slate-500/10 text-slate-700';
}

export async function generateMetadata({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{ selectedServer?: string }>;
}): Promise<Metadata> {
  const resolvedSearchParams = searchParams ? await searchParams : {};
  const pageData = await getApplicationDetailPageData(params, resolvedSearchParams.selectedServer?.trim() || null);
  const name = 'notFound' in pageData ? null : pageData.supervisor ? pageData.processName : pageData.application?.name;
  return { title: name ? `${name}, Neup.Cloud` : 'Neup.Cloud' };
}

export default async function ApplicationDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{ selectedServer?: string }>;
}) {
  const resolvedSearchParams = searchParams ? await searchParams : {};
  const pageData = await getApplicationDetailPageData(params, resolvedSearchParams.selectedServer?.trim() || null);

  if ('notFound' in pageData && pageData.notFound) notFound();

  if (pageData.supervisor) {
    const { processName, processDetails, summary, serverName } = pageData;
    if (!processDetails && !summary) notFound();

    const state = summary?.state || (() => {
      const status = processDetails?.pm2_env?.status;
      if (status === 'online') return 'RUNNING';
      if (status === 'errored') return 'FATAL';
      if (status === 'launching') return 'STARTING';
      if (status === 'stopped') return 'STOPPED';
      return 'UNKNOWN';
    })();

    return (
      <div className="flex flex-col gap-8 max-w-4xl animate-in fade-in duration-500">
        <div className="flex flex-col gap-2">
          <PageTitleBack
            title={<span className="flex items-center gap-3"><AppWindow className="h-8 w-8 text-primary" />{processName}</span>}
            description="Supervisor-only application"
            serverName={serverName}
            backHref="/server/applications"
          >
            <Badge variant="outline" className="text-sm py-1 px-3 border-primary/20 bg-primary/5">run.custom</Badge>
          </PageTitleBack>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Process</CardTitle>
              <CardDescription>Supervisor process status</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Badge variant="outline" className={getSupervisorBadgeClasses(state)}>{state.toLowerCase()}</Badge>
              <div className="space-y-2 text-sm text-muted-foreground">
                <p><span className="font-medium text-foreground">Name:</span> {processName}</p>
                <p><span className="font-medium text-foreground">PID:</span> {summary?.pid ?? 'N/A'}</p>
                <p><span className="font-medium text-foreground">Uptime:</span> {summary?.uptime || 'N/A'}</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Supervisor</CardTitle>
              <CardDescription>Limited controls for this process</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2 text-sm text-muted-foreground">
                <p><span className="font-medium text-foreground">Directory:</span> {processDetails?.pm2_env?.pm_cwd || 'N/A'}</p>
                <p><span className="font-medium text-foreground">Command:</span> {processDetails?.pm2_env?.pm_exec_path || 'N/A'}</p>
              </div>
              <SupervisorOnlyActions processName={processName} />
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  const { application, appLanguage, serverName, maps, runningSection } = pageData;

  return (
    <div className="flex flex-col gap-8 max-w-5xl animate-in fade-in duration-500">
      <div className="flex flex-col gap-2">
        <PageTitleBack
          title={
            <span className="flex items-center gap-3">
              {application.appIcon ? (
                <img src={application.appIcon} alt={application.name} className="h-12 w-12 rounded-lg object-contain border border-border shadow-sm bg-muted/30 p-1" />
              ) : (
                <AppWindow className="h-8 w-8 text-primary" />
              )}
              {application.name}
            </span>
          }
          description="Application details and management"
          serverName={serverName}
          backHref="/server/applications"
        >
          <Badge variant="outline" className="text-sm py-1 px-3 border-primary/20 bg-primary/5">{appLanguage}</Badge>
        </PageTitleBack>
        {!serverName && null}
      </div>

      <StatusDashboard applicationId={application.id} />
      <RunningInSection applicationId={application.id} maps={maps} runningSection={runningSection} />
      <ApplicationLifecycleWrapper applicationId={application.id} application={application} />
      {application.repository ? <GitHubSection application={application} /> : null}
      <SystemSection application={application} />
      <DeploymentActionsCard
        applicationId={application.id}
        onOpenEnvironments={undefined}
        onOpenFiles={undefined}
      />
      <ApplicationActions applicationId={application.id} />
    </div>
  );
}

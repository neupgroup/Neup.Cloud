
import { cookies } from 'next/headers';
import { notFound } from 'next/navigation';
import { getApplication, getProcessDetails, getSupervisorProcesses } from '../actions';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { AppWindow } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { PageTitleBack } from '@/components/page-header';
import { Edit } from 'lucide-react';
import { GitHubSection } from './github-section';
import { SystemSection } from './system-section';
import { LifecycleSection } from './lifecycle-section';
import { DeploymentActionsCard } from './deployment-actions-card';
import { DeleteApplicationButton } from './delete-application-button';
import { LogsSection } from './logs-section';
import { StatusDashboard } from './status-dashboard';
import { Separator } from '@/components/ui/separator';

import * as NextJs from '@/core/nextjs';
import * as NodeJs from '@/core/nodejs';
import * as Python from '@/core/python';
import * as Go from '@/core/go';
import { SupervisorOnlyActions } from './supervisor-only-actions';

function getSupervisorBadgeClasses(state: string) {
    const normalizedState = state.toUpperCase();

    if (normalizedState === 'RUNNING') return 'border-green-500/20 bg-green-500/10 text-green-700';
    if (normalizedState === 'FATAL' || normalizedState === 'BACKOFF') return 'border-orange-500/20 bg-orange-500/10 text-orange-700';
    if (normalizedState === 'STOPPED' || normalizedState === 'EXITED') return 'border-red-500/20 bg-red-500/10 text-red-700';
    return 'border-slate-500/20 bg-slate-500/10 text-slate-700';
}

export default async function ApplicationDetailPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    const cookieStore = await cookies();
    const serverName = cookieStore.get('selected_server_name')?.value;

    if (id.startsWith('supervisor_')) {
        const processName = id.slice('supervisor_'.length);
        const [processDetails, supervisorProcesses] = await Promise.all([
            getProcessDetails('supervisor', processName),
            getSupervisorProcesses(),
        ]);

        const summary = Array.isArray(supervisorProcesses)
            ? supervisorProcesses.find((process: any) => process.name === processName)
            : null;

        if (!processDetails && !summary) {
            notFound();
        }

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
                        title={
                            <span className="flex items-center gap-3">
                                <AppWindow className="h-8 w-8 text-primary" />
                                {processName}
                            </span>
                        }
                        description="Supervisor-only application"
                        serverName={serverName}
                        backHref="/server/applications"
                    >
                        <Badge variant="outline" className="text-sm py-1 px-3 border-primary/20 bg-primary/5">
                            run.custom
                        </Badge>
                    </PageTitleBack>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                    <Card>
                        <CardHeader>
                            <CardTitle>Process</CardTitle>
                            <CardDescription>Supervisor process status</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <Badge variant="outline" className={getSupervisorBadgeClasses(state)}>
                                {state.toLowerCase()}
                            </Badge>
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

    const application = await getApplication(id) as any;

    if (!application) {
        notFound();
    }

    // Determine Status (Simplified Mock for UI structure as per request)
    // "a card for now static, a card to see if the site is active or not."
    // In real app, we would ping the server/status file.
    const appLanguage = application.language === 'next' ? 'Next.js' :
        application.language === 'node' ? 'Node.js' :
            application.language === 'python' ? 'Python' :
                application.language === 'go' ? 'Go' : 'Custom';

    // Always regenerate managed framework lifecycle commands from the stored supervisor service name.
    if (!application.commands) {
        application.commands = {};
    }

    // Build context for command generation
    const uniquePorts = application.networkAccess?.map(Number).filter((p: number) => !isNaN(p) && p > 0) || [];

    const context = {
        applicationId: application.id,
        appName: application.name,
        appLocation: application.location,
        preferredPorts: uniquePorts,
        entryFile: application.information?.entryFile,
        supervisorServiceName: application.information?.supervisorServiceName,
    };

    // Get all commands from the appropriate module
    let commandsArray: any[] = [];

    if (application.language === 'next') {
        commandsArray = NextJs.getCommands(context);
    } else if (application.language === 'node') {
        commandsArray = NodeJs.getCommands(context);
    } else if (application.language === 'python') {
        commandsArray = Python.getCommands(context);
    } else if (application.language === 'go') {
        commandsArray = Go.getCommands(context);
    }

    // Inject commands into application.commands
    commandsArray.forEach((cmdDef: any) => {
        const name = cmdDef.title.toLowerCase();
        const parts = [];
        if (cmdDef.command.preCommand) parts.push(cmdDef.command.preCommand);
        parts.push(cmdDef.command.mainCommand);
        if (cmdDef.command.postCommand) parts.push(cmdDef.command.postCommand);

        application.commands[name] = parts.join('\n');
    });

    // Store command definitions for the UI
    application.commandDefinitions = commandsArray;

    return (
        <div className="flex flex-col gap-8 max-w-5xl animate-in fade-in duration-500">
            {/* Header Section */}
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
                    <Badge variant="outline" className="text-sm py-1 px-3 border-primary/20 bg-primary/5">
                        {appLanguage}
                    </Badge>
                </PageTitleBack>
            </div>

            {/* Status Dashboard */}
            <StatusDashboard applicationId={application.id} />


            {/* Lifecycle Section (Build, Start, Stop, Restart) - Moved up */}
            <LifecycleSection application={application} />




            {/* GitHub / Repository Section */}
            {
                application.repository && (
                    <GitHubSection application={application} />
                )
            }

            {/* Logs Section */}
            <LogsSection application={application} />

            {/* System Info Section */}
            <SystemSection application={application} />

            {/* Deployment & Configuration Card */}
            <DeploymentActionsCard applicationId={application.id} />

            {/* Edit and Delete Actions */}
            <div className="flex items-center gap-3 pt-4">
                <Link href={`/server/applications/${application.id}/edit`}>
                    <Button variant="outline" className="gap-2">
                        <Edit className="h-4 w-4" />
                        Edit Application
                    </Button>
                </Link>

                <DeleteApplicationButton applicationId={application.id} />
            </div>

        </div >
    );
}

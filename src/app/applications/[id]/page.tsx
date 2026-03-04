
import { cookies } from 'next/headers';
import { notFound } from 'next/navigation';
import { getApplication } from '../actions';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { AppWindow, Code, FolderOpen, GitBranch, Network, User, Calendar, Activity, PlayCircle, StopCircle, HardDrive } from 'lucide-react';
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

export default async function ApplicationDetailPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    const cookieStore = await cookies();
    const serverName = cookieStore.get('selected_server_name')?.value;
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

    // Inject Default Commands if missing using new unified structure
    if (!application.commands) {
        application.commands = {};
    }

    // Build context for command generation
    const uniquePorts = application.networkAccess?.map(Number).filter((p: number) => !isNaN(p) && p > 0) || [];

    const context = {
        appName: application.name,
        appLocation: application.location,
        preferredPorts: uniquePorts,
        entryFile: application.information?.entryFile,
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
        if (!application.commands[name]) {
            // Build the full command string from pre/main/post
            const parts = [];
            if (cmdDef.command.preCommand) parts.push(cmdDef.command.preCommand);
            parts.push(cmdDef.command.mainCommand);
            if (cmdDef.command.postCommand) parts.push(cmdDef.command.postCommand);

            application.commands[name] = parts.join('\n');
        }
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
                            <AppWindow className="h-8 w-8 text-primary" />
                            {application.name}
                        </span>
                    }
                    description="Application details and management"
                    serverName={serverName}
                    backHref="/applications"
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
                <Link href={`/applications/${application.id}/edit`}>
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

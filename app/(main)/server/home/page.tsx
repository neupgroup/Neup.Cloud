/*
::neup.documentation::server-home-page

Server dashboard entry page for the selected server.

::private

Shows quick links into each major server management area.

::private end
::end
*/

"use client";

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Activity, TerminalSquare, FolderOpen, Rocket, Database, Globe, HardDrive, Shield, Mail, Cpu } from 'lucide-react';
import { PageTitle } from '@/components/page-header';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { getServer, getSystemStats } from '@/services/server/server-service';
import { getServerUptime } from '@/services/server/status';
import { getCommandLog, type CommandLog } from '@/services/logs/command-log';
import { useSelectedServerId } from '@/inapp/hooks/use-selected-server';
import { ApplicationSection } from '@/components/specifics/application/section';
import { CommandLogList, CommandLogListSkeleton } from '@/app/(main)/server/commands/command-log-card';
import { SystemHealthCard } from '@/components/system-health-card';
import { useServerName } from '@/inapp/hooks/use-server-name';

const serverAlerts = [
    { id: 'cpu-spike', title: 'CPU Spike by 20%', severity: 'Error', time: 'Before 2 mins' },
    { id: 'disk-warning', title: 'Disk usage increased by 14%', severity: 'Warning', time: 'Before 8 mins' },
    { id: 'ssh-failures', title: 'SSH failures increased by 6 attempts', severity: 'Warning', time: 'Before 18 mins' },
];

function alertDotClass(severity: string) {
    if (severity === 'Error') return 'bg-red-500';
    if (severity === 'Warning') return 'bg-amber-500';
    return 'bg-blue-500';
}

export default function ServerHomePage() {
    const serverName = useServerName();
    const selectedServerId = useSelectedServerId();
    const [serverInfo, setServerInfo] = useState<Awaited<ReturnType<typeof getServer>>>(null);
    const [uptime, setUptime] = useState<string | null>(null);
    const [activityLogs, setActivityLogs] = useState<CommandLog[]>([]);
    const [logsLoading, setLogsLoading] = useState(false);
    const [dashboardLoading, setDashboardLoading] = useState(false);
    const [systemStats, setSystemStats] = useState<{
        cpuUsage: number;
        memory: { total: number; used: number; percentage: number };
    } | null>(null);

    useEffect(() => {
        let cancelled = false;

        setServerInfo(null);
        setUptime(null);
        setActivityLogs([]);
        setSystemStats(null);

        if (!selectedServerId) {
            setDashboardLoading(false);
            return;
        }

        const serverId = selectedServerId;

        setDashboardLoading(true);
        setLogsLoading(true);

        async function loadDashboard() {
            try {
                const [info, activity] = await Promise.all([
                    getServer(serverId),
                    getCommandLog({ serverId, limit: 5, offset: 0 }),
                ]);

                if (cancelled) return;
                setServerInfo(info);
                setActivityLogs(activity);

                const [stats, uptimeResult] = await Promise.all([
                    getSystemStats(serverId),
                    getServerUptime(serverId),
                ]);

                if (cancelled) return;
                if (stats && !stats.error && stats.cpuUsage !== undefined) {
                    setSystemStats(stats as typeof systemStats);
                }
                if (uptimeResult.uptime) setUptime(uptimeResult.uptime);
            } catch (error) {
                if (!cancelled) console.error('Failed to load server dashboard', error);
            } finally {
                if (!cancelled) {
                    setLogsLoading(false);
                    setDashboardLoading(false);
                }
            }
        }

        loadDashboard();
        const interval = setInterval(async () => {
            try {
                const stats = await getSystemStats(serverId);
                if (!cancelled && stats && !stats.error && stats.cpuUsage !== undefined) {
                    setSystemStats(stats as typeof systemStats);
                }
            } catch (error) {
                if (!cancelled) console.error('Failed to refresh server stats', error);
            }
        }, 15000);

        return () => {
            cancelled = true;
            clearInterval(interval);
        };
    }, [selectedServerId]);

    return (
        <div className="space-y-8">
            <PageTitle
                title="Server Management"
                description={
                    <>
                        <span>Open and manage each server area from one dashboard </span>
                    </>
                }
                serverName={serverName}
            />

            {!selectedServerId ? (
                <Card>
                    <CardContent className="p-6 text-sm text-muted-foreground">
                        Select a server from the home page to view its dashboard.
                    </CardContent>
                </Card>
            ) : (
                <>
                    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                        <Card>
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                <CardTitle className="text-sm font-medium">Memory Usage</CardTitle>
                                <Activity className="h-4 w-4 text-muted-foreground" />
                            </CardHeader>
                            <CardContent>
                                {dashboardLoading ? <Skeleton className="h-14 w-24" /> : <>
                                    <div className="text-2xl font-bold">{systemStats ? `${systemStats.memory.percentage}%` : '...'}</div>
                                    <p className="text-xs text-muted-foreground">{systemStats ? `${systemStats.memory.used}MB / ${systemStats.memory.total}MB` : 'Fetching live data...'}</p>
                                </>}
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                <CardTitle className="text-sm font-medium">CPU Usage</CardTitle>
                                <Cpu className="h-4 w-4 text-muted-foreground" />
                            </CardHeader>
                            <CardContent>
                                {dashboardLoading ? <Skeleton className="h-14 w-24" /> : <>
                                    <div className="text-2xl font-bold">{systemStats ? `${systemStats.cpuUsage.toFixed(1)}%` : '...'}</div>
                                    <p className="text-xs text-muted-foreground">Live utilization</p>
                                </>}
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                <CardTitle className="text-sm font-medium">Public IP</CardTitle>
                                <Globe className="h-4 w-4 text-muted-foreground" />
                            </CardHeader>
                            <CardContent>
                                {dashboardLoading ? <Skeleton className="h-14 w-32" /> : <>
                                    <div className="truncate text-2xl font-bold">{serverInfo?.publicIp || 'N/A'}</div>
                                    <p className="truncate text-xs text-muted-foreground">{serverInfo?.provider || 'Global Cloud'}</p>
                                </>}
                            </CardContent>
                        </Card>

                        <SystemHealthCard uptime={uptime} />
                    </div>

                    <ApplicationSection
                        source="all"
                        statusFilter={['running', 'crashed']}
                        selectedServerId={selectedServerId}
                        title="Applications"
                        description="Currently running applications."
                        hideWhenEmpty
                    />

                    {(dashboardLoading || logsLoading || activityLogs.length > 0) && (
                        <div className="space-y-4">
                            <div className="space-y-1">
                                <h2 className="text-xl font-bold tracking-tight">Recent Activity</h2>
                                <p className="text-sm text-muted-foreground">Recent commands and server events.</p>
                            </div>
                            {dashboardLoading || logsLoading ? <CommandLogListSkeleton rows={5} /> : <CommandLogList logs={activityLogs} />}
                            <Button variant="outline" asChild>
                                <Link href={`/server/commands/history?selectedServer=${encodeURIComponent(selectedServerId)}`}>See all activities</Link>
                            </Button>
                        </div>
                    )}

                    <div className="space-y-4">
                        <div className="space-y-1">
                            <h2 className="text-xl font-bold tracking-tight">Server Alerts</h2>
                            <p className="text-sm text-muted-foreground">Recent alerts on this server.</p>
                        </div>
                        <Card className="overflow-hidden">
                            {serverAlerts.map((alert, index) => (
                                <div key={alert.id} className={`px-4 py-4 ${index < serverAlerts.length - 1 ? 'border-b' : ''}`}>
                                    <div className="flex items-start gap-2">
                                        <span className={`mt-2 h-2.5 w-2.5 shrink-0 rounded-full ${alertDotClass(alert.severity)}`} />
                                        <div>
                                            <p className="font-semibold">{alert.title} on {serverInfo?.name || serverName || 'selected server'}</p>
                                            <p className="text-sm text-muted-foreground">{alert.time}</p>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </Card>
                    </div>
                </>
            )}

            {/* Server Features Grid */}
            <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
                <Card>
                    <CardHeader>
                        <div className="flex items-center gap-2">
                            <Activity className="h-5 w-5 text-muted-foreground" />
                            <CardTitle>Status</CardTitle>
                        </div>
                        <CardDescription>
                            Monitor live and historical metrics for CPU, memory, temperature, network, and processes.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="text-sm text-muted-foreground">
                        Includes charts, process controls, and connectivity visibility.
                    </CardContent>
                    <CardFooter className="border-t px-6 py-4">
                        <Button asChild className="w-full">
                            <Link href="/server/status">Open Status</Link>
                        </Button>
                    </CardFooter>
                </Card>

                <Card>
                    <CardHeader>
                        <div className="flex items-center gap-2">
                            <Mail className="h-5 w-5 text-muted-foreground" />
                            <CardTitle>Mail</CardTitle>
                        </div>
                        <CardDescription>
                            Configure domain mail routing and run the outbound SMTP port check on this server.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="text-sm text-muted-foreground">
                        Uses the guided domain and server selection workflow.
                    </CardContent>
                    <CardFooter className="border-t px-6 py-4">
                        <Button asChild className="w-full">
                            <Link href="/server/mail">Open Mail</Link>
                        </Button>
                    </CardFooter>
                </Card>

                <Card>
                    <CardHeader>
                        <div className="flex items-center gap-2">
                            <TerminalSquare className="h-5 w-5 text-muted-foreground" />
                            <CardTitle>Commands</CardTitle>
                        </div>
                        <CardDescription>
                            Run one-off commands, use saved commands, and inspect command execution history.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="text-sm text-muted-foreground">
                        Supports command execution workflows and live sessions.
                    </CardContent>
                    <CardFooter className="border-t px-6 py-4">
                        <Button asChild className="w-full">
                            <Link href="/server/commands">Open Commands</Link>
                        </Button>
                    </CardFooter>
                </Card>

                <Card>
                    <CardHeader>
                        <div className="flex items-center gap-2">
                            <FolderOpen className="h-5 w-5 text-muted-foreground" />
                            <CardTitle>Files</CardTitle>
                        </div>
                        <CardDescription>
                            Browse and manage files on the selected server.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="text-sm text-muted-foreground">
                        Quick access to server-side file operations.
                    </CardContent>
                    <CardFooter className="border-t px-6 py-4">
                        <Button asChild className="w-full">
                            <Link href="/server/files">Open Files</Link>
                        </Button>
                    </CardFooter>
                </Card>

                <Card>
                    <CardHeader>
                        <div className="flex items-center gap-2">
                            <Rocket className="h-5 w-5 text-muted-foreground" />
                            <CardTitle>Applications</CardTitle>
                        </div>
                        <CardDescription>
                            Manage deployments, app settings, environments, and release operations.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="text-sm text-muted-foreground">
                        Central place for app lifecycle tasks on this server.
                    </CardContent>
                    <CardFooter className="border-t px-6 py-4">
                        <Button asChild className="w-full">
                            <Link href="/server/applications">Open Applications</Link>
                        </Button>
                    </CardFooter>
                </Card>

                <Card>
                    <CardHeader>
                        <div className="flex items-center gap-2">
                            <Database className="h-5 w-5 text-muted-foreground" />
                            <CardTitle>Database</CardTitle>
                        </div>
                        <CardDescription>
                            Create and manage database instances and credentials.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="text-sm text-muted-foreground">
                        Covers database configuration, users, and management pages.
                    </CardContent>
                    <CardFooter className="border-t px-6 py-4">
                        <Button asChild className="w-full">
                            <Link href="/server/database">Open Database</Link>
                        </Button>
                    </CardFooter>
                </Card>

                <Card>
                    <CardHeader>
                        <div className="flex items-center gap-2">
                            <Globe className="h-5 w-5 text-muted-foreground" />
                            <CardTitle>Webservices</CardTitle>
                        </div>
                        <CardDescription>
                            Configure Nginx and SSL certificates for hosted applications and domains.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="text-sm text-muted-foreground">
                        Includes nginx config editing and certificate flows.
                    </CardContent>
                    <CardFooter className="border-t px-6 py-4">
                        <Button asChild className="w-full">
                            <Link href="/server/webservices">Open Webservices</Link>
                        </Button>
                    </CardFooter>
                </Card>

                <Card>
                    <CardHeader>
                        <div className="flex items-center gap-2">
                            <HardDrive className="h-5 w-5 text-muted-foreground" />
                            <CardTitle>System</CardTitle>
                        </div>
                        <CardDescription>
                            Handle packages, updates, storage, requirements, and swap settings.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="text-sm text-muted-foreground">
                        Core maintenance and system-level controls.
                    </CardContent>
                    <CardFooter className="border-t px-6 py-4">
                        <Button asChild className="w-full">
                            <Link href="/server/system">Open System</Link>
                        </Button>
                    </CardFooter>
                </Card>

                <Card>
                    <CardHeader>
                        <div className="flex items-center gap-2">
                            <Shield className="h-5 w-5 text-muted-foreground" />
                            <CardTitle>Firewall</CardTitle>
                        </div>
                        <CardDescription>
                            Manage server network access, firewall keys, and users.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="text-sm text-muted-foreground">
                        Security controls for network and access management.
                    </CardContent>
                    <CardFooter className="border-t px-6 py-4">
                        <Button asChild className="w-full">
                            <Link href="/server/firewall">Open Firewall</Link>
                        </Button>
                    </CardFooter>
                </Card>
            </div>
        </div>
    );
}

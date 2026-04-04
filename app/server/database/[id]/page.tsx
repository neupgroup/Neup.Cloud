
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import { Database, Settings, Activity, ShieldCheck, HardDrive, Trash2, Key, Users, Table, Terminal, RefreshCw, ChevronRight, Plus, Download } from "lucide-react";
import { cookies } from "next/headers";
import { Button } from "@/components/ui/button";
import { PageTitleBack } from "@/components/page-header";
import type { Metadata } from 'next';
import { Badge } from "@/components/ui/badge";
import { getDatabaseDetails } from "@/actions/database";
import { notFound } from "next/navigation";
import Link from 'next/link';

export const metadata: Metadata = {
    title: 'Database Details | Neup.Cloud',
};

type Props = {
    params: Promise<{ id: string }>
}

export default async function DatabaseDetailsPage({ params }: Props) {
    const { id } = await params;
    const cookieStore = await cookies();
    const serverId = cookieStore.get('selected_server')?.value;

    if (!serverId) notFound();

    // Parse ID: Format is "engine-name"
    const parts = id.split('-');
    if (parts.length < 2) notFound();

    const engine = parts[0] as 'mariadb' | 'postgres';
    const dbName = parts.slice(1).join('-');

    let details = null;
    try {
        details = await getDatabaseDetails(serverId, engine, dbName);
    } catch (error) {
        console.error(error);
        notFound();
    }

    return (
        <div className="grid gap-8 animate-in fade-in slide-in-from-bottom-2 duration-500 pb-20">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <PageTitleBack
                    backHref="/server/database"
                    title={
                        <span className="flex items-center gap-3">
                            <span className="p-2.5 bg-primary/10 rounded-xl">
                                <Database className="w-6 h-6 text-primary" />
                            </span>
                            <div className="flex flex-col">
                                <div className="flex items-center gap-2">
                                    <span className="font-bold tracking-tight">{details.name}</span>
                                    <Badge variant="outline" className="text-[10px] uppercase bg-primary/5 text-primary border-primary/20">
                                        {details.engine}
                                    </Badge>
                                </div>
                                <span className="text-sm font-normal text-muted-foreground">Database Instance</span>
                            </div>
                        </span>
                    }
                />
                <div className="flex items-center gap-2 px-1">
                    <Button variant="outline" size="sm" className="gap-2">
                        <RefreshCw className="h-3.5 w-3.5" /> Refresh
                    </Button>

                </div>
            </div>


            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mt-2">
                <Card className="bg-primary/5 border-primary/10">
                    <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
                        <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Size on Disk</CardTitle>
                        <HardDrive className="h-4 w-4 text-primary opacity-70" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{details.size}</div>
                        <p className="text-[10px] text-muted-foreground mt-1 flex items-center gap-1">
                            <Activity className="h-3 w-3 text-green-500" /> Usage stable
                        </p>
                    </CardContent>
                </Card>
                <Link href={`/server/database/${id}/table`}>
                    <Card className="transition-all hover:bg-muted/50 cursor-pointer h-full">
                        <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
                            <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Tables</CardTitle>
                            <Table className="h-4 w-4 text-muted-foreground opacity-70" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">{details.tablesCount}</div>
                            <p className="text-[10px] text-muted-foreground mt-1">Schema defined</p>
                        </CardContent>
                    </Card>
                </Link>
                <Card>
                    <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
                        <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Users</CardTitle>
                        <Users className="h-4 w-4 text-muted-foreground opacity-70" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{details.userCount}</div>
                        <p className="text-[10px] text-muted-foreground mt-1">Authorized roles</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
                        <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Health Status</CardTitle>
                        <ShieldCheck className="h-4 w-4 text-green-500 opacity-70" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-green-500">OPTIMAL</div>
                        <p className="text-[10px] text-muted-foreground mt-1">Integrity verified</p>
                    </CardContent>
                </Card>
            </div>

            {/* Process-Style Cards - Single Column */}
            <div className="space-y-6">
                <h2 className="text-xl font-semibold font-headline tracking-tight">Management</h2>

                <Card className="min-w-0 w-full rounded-lg border bg-card text-card-foreground shadow-sm">
                    {/* Database Tables */}
                    <Link href={`/server/database/${id}/table`} className="block">
                        <div className="p-4 min-w-0 w-full transition-colors hover:bg-muted/50 border-b border-border">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-4 min-w-0 flex-1">
                                    <div className="p-2 rounded-lg shrink-0 bg-cyan-500/10 text-cyan-500">
                                        <Table className="h-5 w-5" />
                                    </div>
                                    <div className="min-w-0 flex-1">
                                        <div className="flex items-center gap-2 mb-1">
                                            <span className="font-bold text-base">Database Tables</span>
                                            <Badge variant="secondary" className="text-[10px]">{details.tablesCount} tables</Badge>
                                        </div>
                                        <p className="text-xs text-muted-foreground">
                                            View schema information, row counts, and storage usage
                                        </p>
                                    </div>
                                </div>
                                <ChevronRight className="h-5 w-5 text-muted-foreground shrink-0" />
                            </div>
                        </div>
                    </Link>

                    {/* Manage Users */}
                    <Link href={`/server/database/${id}/users`} className="block">
                        <div className="p-4 min-w-0 w-full transition-colors hover:bg-muted/50 border-b border-border">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-4 min-w-0 flex-1">
                                    <div className="p-2 rounded-lg shrink-0 bg-blue-500/10 text-blue-500">
                                        <Users className="h-5 w-5" />
                                    </div>
                                    <div className="min-w-0 flex-1">
                                        <div className="flex items-center gap-2 mb-1">
                                            <span className="font-bold text-base">Manage Users</span>
                                            <Badge variant="secondary" className="text-[10px]">{details.userCount} users</Badge>
                                        </div>
                                        <p className="text-xs text-muted-foreground">
                                            View, create, and manage database users and their permissions
                                        </p>
                                    </div>
                                </div>
                                <ChevronRight className="h-5 w-5 text-muted-foreground shrink-0" />
                            </div>
                        </div>
                    </Link>

                    {/* Remote Connection */}
                    <Link href={`/server/database/${id}/connection`} className="block">
                        <div className="p-4 min-w-0 w-full transition-colors hover:bg-muted/50 border-b border-border">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-4 min-w-0 flex-1">
                                    <div className="p-2 rounded-lg shrink-0 bg-green-500/10 text-green-500">
                                        <Terminal className="h-5 w-5" />
                                    </div>
                                    <div className="min-w-0 flex-1">
                                        <div className="flex items-center gap-2 mb-1">
                                            <span className="font-bold text-base">Remote Connection</span>
                                            <Badge variant="outline" className="text-[10px] bg-green-500/10 text-green-500 border-green-500/20">Secure</Badge>
                                        </div>
                                        <p className="text-xs text-muted-foreground">
                                            View connection details and code examples • Port: {details.engine === 'mariadb' ? '3306' : '5432'}
                                        </p>
                                    </div>
                                </div>
                                <ChevronRight className="h-5 w-5 text-muted-foreground shrink-0" />
                            </div>
                        </div>
                    </Link>

                    {/* Quick Shell */}
                    <Link href={`/server/database/${id}/shell`} className="block">
                        <div className="p-4 min-w-0 w-full transition-colors hover:bg-muted/50 border-b border-border">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-4 min-w-0 flex-1">
                                    <div className="p-2 rounded-lg shrink-0 bg-purple-500/10 text-purple-500">
                                        <Terminal className="h-5 w-5" />
                                    </div>
                                    <div className="min-w-0 flex-1">
                                        <div className="flex items-center gap-2 mb-1">
                                            <span className="font-bold text-base">Quick Shell</span>
                                        </div>
                                        <p className="text-xs text-muted-foreground">
                                            Run interactive SQL commands in a secure temporary session
                                        </p>
                                    </div>
                                </div>
                                <ChevronRight className="h-5 w-5 text-muted-foreground shrink-0" />
                            </div>
                        </div>
                    </Link>

                    {/* Generate Backup */}
                    <Link href={`/server/database/${id}/backup`} className="block">
                        <div className="p-4 min-w-0 w-full transition-colors hover:bg-muted/50 border-b border-border">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-4 min-w-0 flex-1">
                                    <div className="p-2 rounded-lg shrink-0 bg-indigo-500/10 text-indigo-500">
                                        <Download className="h-5 w-5" />
                                    </div>
                                    <div className="min-w-0 flex-1">
                                        <div className="flex items-center gap-2 mb-1">
                                            <span className="font-bold text-base">Generate Backup</span>
                                        </div>
                                        <p className="text-xs text-muted-foreground">
                                            Export database schema and data as SQL dump file
                                        </p>
                                    </div>
                                </div>
                                <ChevronRight className="h-5 w-5 text-muted-foreground shrink-0" />
                            </div>
                        </div>
                    </Link>

                    {/* Engine Settings */}
                    <Link href={`/server/database/${id}/settings`} className="block">
                        <div className="p-4 min-w-0 w-full transition-colors hover:bg-muted/50">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-4 min-w-0 flex-1">
                                    <div className="p-2 rounded-lg shrink-0 bg-orange-500/10 text-orange-500">
                                        <Settings className="h-5 w-5" />
                                    </div>
                                    <div className="min-w-0 flex-1">
                                        <div className="flex items-center gap-2 mb-1">
                                            <span className="font-bold text-base">Engine Settings</span>
                                        </div>
                                        <p className="text-xs text-muted-foreground">
                                            Configure remote access, shell sessions, and performance tuning
                                        </p>
                                    </div>
                                </div>
                                <ChevronRight className="h-5 w-5 text-muted-foreground shrink-0" />
                            </div>
                        </div>
                    </Link>
                </Card>

                {/* Maintenance Notice */}
                <div className="p-4 bg-amber-500/5 border border-amber-500/10 rounded-xl space-y-3">
                    <div className="flex items-center gap-2 text-amber-600 dark:text-amber-500">
                        <Activity className="h-4 w-4" />
                        <span className="text-xs font-bold uppercase tracking-wider">Maintenance Schedule</span>
                    </div>
                    <p className="text-[11px] text-amber-900/70 dark:text-amber-500/70 leading-relaxed">
                        Backups are scheduled every 24 hours. The next backup is scheduled for midnight (GMT).
                    </p>
                </div>
            </div>
        </div>
    );
}

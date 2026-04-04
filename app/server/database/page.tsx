
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import { Database, Plus, Server, Settings, Activity, ShieldCheck, CheckCircle, AlertCircle, HardDrive, Trash2, ExternalLink, ChevronRight } from "lucide-react";
import { cookies } from "next/headers";
import Link from 'next/link';
import { Button } from "@/components/ui/button";
import { PageTitle } from "@/components/page-header";
import type { Metadata } from 'next';
import { Badge } from "@/components/ui/badge";
import { checkDatabaseInstallation, listAllDatabases, type DatabaseInstallation, type DatabaseInstance } from "@/actions/database";

export const metadata: Metadata = {
    title: 'Databases | Neup.Cloud',
};

export default async function DatabasePage() {
    const cookieStore = await cookies();
    const serverId = cookieStore.get('selected_server')?.value;
    const serverName = cookieStore.get('selected_server_name')?.value;

    let installation: DatabaseInstallation | null = null;
    let databaseInstances: DatabaseInstance[] = [];

    if (serverId) {
        try {
            [installation, databaseInstances] = await Promise.all([
                checkDatabaseInstallation(serverId),
                listAllDatabases(serverId)
            ]);
        } catch (error) {
            console.error("Failed to fetch database data:", error);
        }
    }

    const installedEngines = installation?.details ? Object.entries(installation.details)
        .filter(([_, info]) => info.status === 'installed')
        .map(([name]) => name) : [];

    return (
        <div className="grid gap-8 animate-in fade-in duration-500 pb-10">
            <PageTitle
                title="Databases"
                description="Manage database engines and instances"
                serverName={serverName}
            />

            {!serverId ? (
                <Card className="text-center p-12 border-dashed bg-muted/20">
                    <div className="mx-auto w-16 h-16 bg-muted rounded-full flex items-center justify-center mb-4">
                        <Server className="h-8 w-8 text-muted-foreground" />
                    </div>
                    <h3 className="text-xl font-semibold">No Server Selected</h3>
                    <p className="mt-2 text-muted-foreground max-w-sm mx-auto">
                        You need to select a server before you can manage its databases.
                    </p>
                    <Button asChild className="mt-6" variant="outline">
                        <Link href="/servers">Go to Servers</Link>
                    </Button>
                </Card>
            ) : (
                <>
                    {/* Stats Cards */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                        <Card className="bg-primary/5 border-primary/10">
                            <CardHeader className="pb-2">
                                <CardTitle className="text-sm font-medium text-muted-foreground">Total Databases</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-bold">{databaseInstances.length}</div>
                            </CardContent>
                        </Card>
                        <Card>
                            <CardHeader className="pb-2">
                                <CardTitle className="text-sm font-medium text-muted-foreground">Running Engines</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-bold flex items-center gap-2">
                                    {installedEngines.length}
                                    {installedEngines.length > 0 ? (
                                        <Badge variant="outline" className="text-[10px] font-normal uppercase">
                                            {installedEngines.join(', ')}
                                        </Badge>
                                    ) : (
                                        <Badge variant="outline" className="text-[10px] font-normal">None</Badge>
                                    )}
                                </div>
                            </CardContent>
                        </Card>
                        <Card>
                            <CardHeader className="pb-2">
                                <CardTitle className="text-sm font-medium text-muted-foreground">Total Size</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-bold">~ MB</div>
                            </CardContent>
                        </Card>
                        <Card>
                            <CardHeader className="pb-2">
                                <CardTitle className="text-sm font-medium text-muted-foreground">Active Connections</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-bold text-green-500">Auto</div>
                            </CardContent>
                        </Card>
                    </div>

                    {/* Databases List */}
                    <div className="grid gap-6">
                        <div>
                            <h2 className="text-2xl font-semibold font-headline tracking-tight">Databases</h2>
                            <p className="text-sm text-muted-foreground mt-1">
                                Manage your database instances, create new databases, and configure access settings.
                            </p>
                        </div>

                        <Card className="min-w-0 w-full rounded-lg border bg-card text-card-foreground shadow-sm">
                            {/* Create Database Item */}
                            <Link href="/server/database/create" className="block">
                                <div className="p-4 min-w-0 w-full transition-colors hover:bg-muted/50 border-b border-dashed border-border">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-4 min-w-0 flex-1">
                                            <div className="p-2 rounded-lg shrink-0 bg-primary/10 text-primary">
                                                <Plus className="h-5 w-5" />
                                            </div>
                                            <div className="min-w-0 flex-1">
                                                <div className="flex items-center gap-2 mb-1">
                                                    <span className="font-bold text-lg">Create New Database</span>
                                                    <Badge variant="outline" className="text-[10px] bg-primary/10 text-primary border-primary/20">NEW</Badge>
                                                </div>
                                                <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-xs text-muted-foreground">
                                                    <span className="flex items-center gap-1.5 shrink-0">
                                                        Set up a new database instance on this server
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                        <ChevronRight className="h-5 w-5 text-muted-foreground shrink-0" />
                                    </div>
                                </div>
                            </Link>

                            {/* Existing Databases */}
                            {databaseInstances.length > 0 ? (
                                <>
                                    {databaseInstances.map((db, idx) => (
                                        <Link
                                            key={`${db.engine}-${db.name}-${idx}`}
                                            href={`/server/database/${db.engine}-${db.name}`}
                                            className="block"
                                        >
                                            <div className={`p-4 min-w-0 w-full transition-colors hover:bg-muted/50 ${idx !== databaseInstances.length - 1 ? 'border-b border-border' : ''}`}>
                                                <div className="flex items-center justify-between">
                                                    <div className="flex items-center gap-4 min-w-0 flex-1">
                                                        <div className={`p-2 rounded-lg shrink-0 ${db.engine === 'mariadb' ? 'bg-blue-500/10 text-blue-500' : 'bg-indigo-500/10 text-indigo-500'}`}>
                                                            <Database className="h-5 w-5" />
                                                        </div>
                                                        <div className="min-w-0 flex-1">
                                                            <div className="flex items-center gap-2 mb-2">
                                                                <span className="font-bold text-lg">{db.name}</span>
                                                                <Badge variant="secondary" className="text-[10px] uppercase">{db.engine}</Badge>
                                                            </div>
                                                            <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-xs text-muted-foreground">
                                                                <span className="flex items-center gap-1.5 shrink-0">
                                                                    <HardDrive className="h-3.5 w-3.5" />
                                                                    External Access Enabled
                                                                </span>
                                                                <span className="flex items-center gap-1.5 shrink-0">
                                                                    <ShieldCheck className="h-3.5 w-3.5" />
                                                                    SSL Active
                                                                </span>
                                                            </div>
                                                        </div>
                                                    </div>
                                                    <ChevronRight className="h-5 w-5 text-muted-foreground shrink-0" />
                                                </div>
                                            </div>
                                        </Link>
                                    ))}
                                </>
                            ) : (
                                <div className="p-8 text-center">
                                    <div className="p-3 bg-muted rounded-full mb-4 inline-flex">
                                        <Database className="h-6 w-6 text-muted-foreground" />
                                    </div>
                                    <p className="text-sm text-muted-foreground max-w-xs mx-auto">
                                        No databases created yet. Click above to create your first database instance.
                                    </p>
                                </div>
                            )}
                        </Card>
                    </div>
                </>
            )}
        </div>
    );
}


import {
    Card,
    CardContent,
    CardHeader,
    CardTitle,
    CardDescription
} from "@/components/ui/card";
import { Table as TableIcon, Database, HardDrive, Clock, FileText } from "lucide-react";
import { cookies } from "next/headers";
import { PageTitleBack } from "@/components/page-header";
import type { Metadata } from 'next';
import { getDatabaseDetails, getDatabaseTables } from "@/actions/database";
import { notFound } from "next/navigation";
import { Badge } from "@/components/ui/badge";

export const metadata: Metadata = {
    title: 'Database Tables | Neup.Cloud',
};

type Props = {
    params: Promise<{ id: string }>
}

export default async function DatabaseTablesPage({ params }: Props) {
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
    let tables = [];

    try {
        [details, tables] = await Promise.all([
            getDatabaseDetails(serverId, engine, dbName),
            getDatabaseTables(serverId, engine, dbName)
        ]);
    } catch (error) {
        console.error(error);
        notFound();
    }

    return (
        <div className="grid gap-8 animate-in fade-in slide-in-from-bottom-2 duration-500 pb-20">
            <PageTitleBack
                backHref={`/server/database/${id}`}
                title={
                    <span className="flex items-center gap-3">
                        <span className="p-2.5 bg-primary/10 rounded-xl">
                            <TableIcon className="w-6 h-6 text-primary" />
                        </span>
                        <div className="flex flex-col">
                            <div className="flex items-center gap-2">
                                <span className="font-bold tracking-tight">Database Tables</span>
                                <Badge variant="outline" className="text-[10px] ml-2 font-normal">
                                    {tables.length} Tables
                                </Badge>
                            </div>
                            <span className="text-sm font-normal text-muted-foreground">{details.name}</span>
                        </div>
                    </span>
                }
            />


            <Card className="min-w-0 w-full rounded-lg border bg-card text-card-foreground shadow-sm overflow-hidden">
                <div className="divide-y divide-border">
                    {tables.length > 0 ? (
                        tables.map((table, idx) => (
                            <div key={idx} className="p-4 min-w-0 w-full transition-colors hover:bg-muted/50">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-4 min-w-0 flex-1">
                                        <div className="p-2 rounded-lg shrink-0 bg-primary/10 text-primary">
                                            <TableIcon className="h-5 w-5" />
                                        </div>
                                        <div className="min-w-0 flex-1">
                                            <div className="flex items-center gap-2 mb-1">
                                                <span className="font-bold text-base font-mono">{table.name}</span>
                                            </div>
                                            <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-xs text-muted-foreground">
                                                <span className="flex items-center gap-1.5 shrink-0">
                                                    <FileText className="h-3.5 w-3.5 opacity-70" />
                                                    {table.rows.toLocaleString()} rows
                                                </span>
                                                <span className="flex items-center gap-1.5 shrink-0">
                                                    <HardDrive className="h-3.5 w-3.5 opacity-70" />
                                                    {table.size}
                                                </span>
                                                {engine === 'mariadb' && table.created && (
                                                    <span className="flex items-center gap-1.5 shrink-0">
                                                        <Clock className="h-3.5 w-3.5 opacity-70" />
                                                        Created {new Date(table.created).toLocaleDateString()}
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                    {/* Action button place holder or just visual balance */}
                                </div>
                            </div>
                        ))
                    ) : (
                        <div className="flex flex-col items-center justify-center py-12 text-center">
                            <div className="p-4 rounded-full bg-muted mb-4">
                                <Database className="h-8 w-8 text-muted-foreground" />
                            </div>
                            <h3 className="text-lg font-semibold mb-2">No Tables Found</h3>
                            <p className="text-muted-foreground max-w-sm mb-6">
                                This database appears to be empty. Create tables using your application or the Quick Shell.
                            </p>
                        </div>
                    )}
                </div>
            </Card>
        </div>
    );
}

'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ChevronLeft, CheckCircle2, Database, HardDrive, Loader2, Terminal } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/core/hooks/use-toast';
import { useSelectedServerHref } from '@/core/hooks/use-selected-server';
import { storeDatabaseBackup } from '@/services/database/database-runtime';

type BackupFile = {
    filename: string;
    path: string;
    mode: 'full' | 'schema';
    sizeBytes: number;
    modifiedAt: string;
};

type BackupSummary = {
    full?: BackupFile;
    schema?: BackupFile;
};

type DatabaseBackupsClientProps = {
    serverId: string;
    engine: 'mariadb' | 'postgres';
    dbName: string;
    databaseSize: string;
    backupSummary: BackupSummary;
};

function formatBackupTime(value?: string) {
    if (!value) return 'No backup yet';

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return 'No backup yet';

    return new Intl.DateTimeFormat(undefined, {
        dateStyle: 'medium',
        timeStyle: 'short',
    }).format(date);
}

export function DatabaseBackupsClient({ serverId, engine, dbName, databaseSize, backupSummary }: DatabaseBackupsClientProps) {
    const { toast } = useToast();
    const withSelectedServer = useSelectedServerHref();
    const [runningMode, setRunningMode] = useState<'full' | 'schema' | null>(null);
    const [storedPath, setStoredPath] = useState<string | null>(null);
    const [latestBackups, setLatestBackups] = useState<BackupSummary>(backupSummary);

    const storeBackup = async (mode: 'full' | 'schema') => {
        setRunningMode(mode);
        setStoredPath(null);

        try {
            const result = await storeDatabaseBackup(serverId, engine, dbName, mode);

            if (!result.success) {
                toast({
                    variant: 'destructive',
                    title: 'Backup Failed',
                    description: result.message || 'The command runner could not store the backup.',
                });
                return;
            }

            setStoredPath(result.path || null);
            setLatestBackups((current) => ({
                ...current,
                [mode]: {
                    filename: result.filename || '',
                    path: result.path || '',
                    mode,
                    sizeBytes: 0,
                    modifiedAt: new Date().toISOString(),
                },
            }));
            toast({
                title: 'Backup Stored',
                description: result.path || result.message,
            });
        } catch (error: any) {
            toast({
                variant: 'destructive',
                title: 'Backup Failed',
                description: error.message || 'The command runner could not store the backup.',
            });
        } finally {
            setRunningMode(null);
        }
    };

    return (
        <div className="grid gap-8 animate-in fade-in slide-in-from-bottom-2 duration-500">
            <div className="space-y-1">
                <Button variant="ghost" className="pl-0 hover:bg-transparent text-muted-foreground hover:text-foreground" asChild>
                    <Link href={withSelectedServer(`/server/database/${engine}-${dbName}/backup`)}>
                        <ChevronLeft className="h-4 w-4 mr-1" /> Back to Export
                    </Link>
                </Button>
                <div className="flex flex-wrap items-center gap-3">
                    <h1 className="text-3xl font-bold tracking-tight">NeupServer Backups</h1>
                    <Badge variant="outline" className="uppercase">{engine === 'postgres' ? 'Postgres' : 'SQL'}</Badge>
                </div>
                <p className="text-muted-foreground">
                    Store database dumps for <span className="text-foreground font-medium">{dbName}</span> through the command runner.
                </p>
            </div>

            <Card className="border-primary/10">
                <CardHeader className="bg-primary/5">
                    <div className="flex items-center justify-between gap-4">
                        <div className="p-2 bg-primary/10 rounded-lg">
                            <Database className="h-6 w-6 text-primary" />
                        </div>
                        <Badge variant="secondary" className="bg-primary/10 text-primary border-primary/20">
                            Command Runner
                        </Badge>
                    </div>
                    <CardTitle>Store Backup in NeupServer</CardTitle>
                    <CardDescription>
                        Files are saved under /[username]/.neup/backups/database as [YYYYMMDD].[database].[full/structure].sql.
                    </CardDescription>
                </CardHeader>
                <CardContent className="pt-6 space-y-5">
                    <div className="grid gap-3 sm:grid-cols-2">
                        <div className="flex items-center justify-between rounded-md border bg-muted/30 px-3 py-2">
                            <span className="flex items-center gap-2 text-sm text-muted-foreground">
                                <HardDrive className="h-4 w-4" />
                                Full export size
                            </span>
                            <span className="text-sm font-semibold text-foreground">{databaseSize}</span>
                        </div>
                        <div className="flex items-center justify-between rounded-md border bg-muted/30 px-3 py-2">
                            <span className="flex items-center gap-2 text-sm text-muted-foreground">
                                <Terminal className="h-4 w-4" />
                                Execution
                            </span>
                            <span className="text-sm font-semibold text-foreground">Runs to completion</span>
                        </div>
                    </div>

                    <div className="grid gap-3 sm:grid-cols-2">
                        <Button
                            className="h-11"
                            onClick={() => storeBackup('full')}
                            disabled={runningMode !== null}
                        >
                            {runningMode === 'full' ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Running Full Backup...
                                </>
                            ) : (
                                <>
                                    <HardDrive className="mr-2 h-4 w-4" />
                                    Store Full Backup
                                </>
                            )}
                        </Button>
                        <div className="rounded-md border bg-muted/20 px-3 py-2 text-sm">
                            <p className="text-muted-foreground">Last full backup</p>
                            <p className="font-medium text-foreground">{formatBackupTime(latestBackups.full?.modifiedAt)}</p>
                        </div>
                        <Button
                            variant="secondary"
                            className="h-11"
                            onClick={() => storeBackup('schema')}
                            disabled={runningMode !== null}
                        >
                            {runningMode === 'schema' ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Running Structure Backup...
                                </>
                            ) : (
                                <>
                                    <Terminal className="mr-2 h-4 w-4" />
                                    Store Structure Backup
                                </>
                            )}
                        </Button>
                        <div className="rounded-md border bg-muted/20 px-3 py-2 text-sm">
                            <p className="text-muted-foreground">Last structure backup</p>
                            <p className="font-medium text-foreground">{formatBackupTime(latestBackups.schema?.modifiedAt)}</p>
                        </div>
                    </div>

                    <div className="space-y-2 rounded-md border bg-muted/20 p-4">
                        <p className="flex items-center gap-2 text-sm text-muted-foreground">
                            <CheckCircle2 className="h-4 w-4 text-green-500" />
                            The backup command is executed by the same command runner used for server operations.
                        </p>
                        {storedPath ? (
                            <p className="break-all text-sm font-medium text-foreground">{storedPath}</p>
                        ) : null}
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}

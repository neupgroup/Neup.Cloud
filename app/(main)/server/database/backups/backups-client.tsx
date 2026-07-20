'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ChevronDown, ChevronLeft, HardDrive, RotateCcw, Trash2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useSelectedServerHref } from '@/core/hooks/use-selected-server';
import type { DatabaseBackupFile } from '@/services/database/engine-types';

type DatabaseBackupsClientProps = {
    engine: 'mariadb' | 'postgres' | null;
    dbName: string | null;
    backups: DatabaseBackupFile[];
    hasSelectedServer: boolean;
};

function formatBackupTime(value?: string) {
    if (!value) return 'No backup yet';

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return 'No backup yet';

    return new Intl.DateTimeFormat('en-US', {
        dateStyle: 'medium',
        timeStyle: 'short',
        hour12: true,
    }).format(date);
}

function formatBackupSize(sizeBytes: number) {
    return `${(sizeBytes / 1024 / 1024).toFixed(2)} MB`;
}

export function DatabaseBackupsClient({ engine, dbName, backups, hasSelectedServer }: DatabaseBackupsClientProps) {
    const withSelectedServer = useSelectedServerHref();
    const [expandedBackup, setExpandedBackup] = useState<string | null>(null);

    return (
        <div className="grid gap-8 animate-in fade-in slide-in-from-bottom-2 duration-500">
            <div className="space-y-1">
                <Button variant="ghost" className="pl-0 hover:bg-transparent text-muted-foreground hover:text-foreground" asChild>
                    <Link href={withSelectedServer('/server/database')}>
                        <ChevronLeft className="h-4 w-4 mr-1" /> Back to Databases
                    </Link>
                </Button>
                <div className="flex flex-wrap items-center gap-3">
                    <h1 className="text-3xl font-bold tracking-tight">NeupServer Backups</h1>
                    {engine ? <Badge variant="outline" className="uppercase">{engine === 'postgres' ? 'Postgres' : 'SQL'}</Badge> : null}
                </div>
                <p className="text-muted-foreground">
                    {dbName ? (
                        <>Store database dumps for <span className="text-foreground font-medium">{dbName}</span> through the command runner.</>
                    ) : (
                        'Store database dumps through the command runner.'
                    )}
                </p>
            </div>

            {backups.length > 0 ? (
                <div>
                    {backups.map((backup, index) => {
                        const backupKey = backup.path || backup.filename;
                        const isExpanded = expandedBackup === backupKey;
                        const isFirst = index === 0;
                        const isLast = index === backups.length - 1;

                        return (
                            <div
                                key={backupKey}
                                className={`border-x border-t bg-card text-card-foreground ${isFirst ? 'rounded-t-md' : ''} ${isLast ? 'rounded-b-md border-b' : ''}`}
                            >
                                <div className="px-4 py-3">
                                    <button
                                        type="button"
                                        className="flex w-full items-center justify-between gap-4 text-left"
                                        onClick={() => setExpandedBackup(isExpanded ? null : backupKey)}
                                        aria-expanded={isExpanded}
                                    >
                                        <div className="flex min-w-0 items-center gap-3">
                                            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
                                                <HardDrive className="h-4 w-4" />
                                            </div>
                                            <div className="min-w-0">
                                                <p className="font-semibold text-sm text-foreground">
                                                    Backup for {backup.mode === 'schema' ? 'structure' : 'full'} {backup.databaseName}
                                                </p>
                                                <p className="text-xs font-semibold text-foreground">{formatBackupSize(backup.sizeBytes)}</p>
                                                <p className="text-xs text-muted-foreground">Backup on {formatBackupTime(backup.modifiedAt)}</p>
                                            </div>
                                        </div>
                                        <ChevronDown className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200 ease-out ${isExpanded ? 'rotate-180' : ''}`} />
                                    </button>

                                    <div
                                        className={`grid transition-all duration-200 ease-out ${isExpanded ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'}`}
                                        aria-hidden={!isExpanded}
                                    >
                                        <div className="overflow-hidden">
                                            <div className={`flex flex-col gap-2 border-t sm:flex-row sm:justify-end transition-all duration-200 ease-out ${isExpanded ? 'mt-3 pt-3' : 'mt-0 pt-0'}`}>
                                                <Button variant="outline" size="sm" className="justify-start gap-2" tabIndex={isExpanded ? 0 : -1}>
                                                    <RotateCcw className="h-4 w-4" />
                                                    Restore Backup
                                                </Button>
                                                <Button variant="destructive" size="sm" className="justify-start gap-2" tabIndex={isExpanded ? 0 : -1}>
                                                    <Trash2 className="h-4 w-4" />
                                                    Delete Backup
                                                </Button>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            ) : (
                <Card className="w-full rounded-md">
                    <CardContent className="px-4 py-3 text-sm text-muted-foreground">
                        {hasSelectedServer ? 'No backup files match the current filters.' : 'Select a server to view backup files.'}
                    </CardContent>
                </Card>
            )}
        </div>
    );
}

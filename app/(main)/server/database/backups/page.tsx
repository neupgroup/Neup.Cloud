import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getDatabaseBackupFiles, getDatabaseDetails, listAllDatabases } from '@/services/database/database-runtime';
import type { DatabaseBackupFile } from '@/services/database/engine-types';
import { resolveSelectedServerId, type DatabaseEngine } from "../route-helpers";
import { DatabaseBackupsClient } from "./backups-client";

export const metadata: Metadata = {
    title: 'Database Backups | Neup.Cloud',
};

type Props = {
    searchParams?: Promise<{
        selectedServer?: string;
        database?: string;
        type?: string;
    }>;
}

function parseBackupType(type: string | undefined): DatabaseEngine | null {
    if (type === 'postgres') return 'postgres';
    if (type === 'sql' || type === 'mariadb' || type === 'mysql') return 'mariadb';
    return null;
}

async function resolveBackupEngine(serverId: string, dbName: string, type: string | undefined) {
    const queryEngine = parseBackupType(type);
    if (queryEngine) return queryEngine;

    const databases = await listAllDatabases(serverId);
    return databases.find((database) => database.name === dbName)?.engine ?? null;
}

/*
::neup.documentation::database-backups-page
::private

Provides a dedicated database backups page. It validates `selectedServer` and `database`, infers the database engine from the selected server when `type` is omitted, and renders stored backup cards for the selected database.

::private end
::end
*/
export default async function DatabaseBackupsPage({ searchParams }: Props) {
    const resolvedSearchParams = searchParams ? await searchParams : {};
    const serverId = await resolveSelectedServerId(Promise.resolve({
        selectedServer: resolvedSearchParams.selectedServer,
    }));
    const dbName = resolvedSearchParams.database?.trim();

    if (!serverId || !dbName) notFound();

    let backups: DatabaseBackupFile[] = [];
    try {
        const engine = await resolveBackupEngine(serverId, dbName, resolvedSearchParams.type);
        if (!engine) notFound();

        [, backups] = await Promise.all([
            getDatabaseDetails(serverId, engine, dbName),
            getDatabaseBackupFiles(serverId, dbName),
        ]);

        return (
            <DatabaseBackupsClient
                engine={engine}
                dbName={dbName}
                backups={backups}
            />
        );
    } catch (error) {
        notFound();
    }
}

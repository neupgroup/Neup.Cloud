import type { Metadata } from "next";
import { getDatabaseBackupFiles, listAllDatabases } from '@/services/database/database-runtime';
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

/*
::neup.documentation::database-backups-page
::private

Provides a dedicated database backups page. Query parameters such as `selectedServer`, `database`, and `type` are filters only; the page renders even when filters are absent or have no matches.

::private end
::end
*/
export default async function DatabaseBackupsPage({ searchParams }: Props) {
    const resolvedSearchParams = searchParams ? await searchParams : {};
    const serverId = await resolveSelectedServerId(Promise.resolve({
        selectedServer: resolvedSearchParams.selectedServer,
    }));
    const dbName = resolvedSearchParams.database?.trim();
    const engineFilter = parseBackupType(resolvedSearchParams.type);

    let backups: DatabaseBackupFile[] = [];
    if (serverId) {
        try {
            backups = await getDatabaseBackupFiles(serverId, dbName);

            if (engineFilter) {
                const databases = await listAllDatabases(serverId);
                const databaseNamesForEngine = new Set(
                    databases
                        .filter((database) => database.engine === engineFilter)
                        .map((database) => database.name)
                );

                backups = backups.filter((backup) => databaseNamesForEngine.has(backup.databaseName));
            }
        } catch (error) {
            backups = [];
        }
    }

    return (
        <DatabaseBackupsClient
            engine={engineFilter}
            dbName={dbName || null}
            backups={backups}
            hasSelectedServer={Boolean(serverId)}
        />
    );
}

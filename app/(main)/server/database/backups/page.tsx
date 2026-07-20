import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getDatabaseBackupSummary, getDatabaseDetails } from '@/services/database/database-runtime';
import type { DatabaseBackupSummary } from '@/services/database/engine-types';
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

Provides a dedicated database backup action page. It validates `selectedServer`, `database`, and `type` query parameters before rendering client controls that execute backup storage through the command runner.

::private end
::end
*/
export default async function DatabaseBackupsPage({ searchParams }: Props) {
    const resolvedSearchParams = searchParams ? await searchParams : {};
    const serverId = await resolveSelectedServerId(Promise.resolve({
        selectedServer: resolvedSearchParams.selectedServer,
    }));
    const dbName = resolvedSearchParams.database?.trim();
    const engine = parseBackupType(resolvedSearchParams.type);

    if (!serverId || !dbName || !engine) notFound();

    let details = null;
    let backupSummary: DatabaseBackupSummary = {};
    try {
        [details, backupSummary] = await Promise.all([
            getDatabaseDetails(serverId, engine, dbName),
            getDatabaseBackupSummary(serverId, dbName),
        ]);
    } catch (error) {
        notFound();
    }

    return (
        <DatabaseBackupsClient
            serverId={serverId}
            engine={engine}
            dbName={dbName}
            databaseSize={details.size}
            backupSummary={backupSummary}
        />
    );
}

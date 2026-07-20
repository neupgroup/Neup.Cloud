
import { notFound } from "next/navigation";
import { BackupClientPage } from "./backup-client";
import { getDatabaseDetails } from '@/services/database/database-runtime';
import type { Metadata } from "next";
import { parseDatabaseRouteId, resolveSelectedServerId } from "../../route-helpers";

export const metadata: Metadata = {
    title: 'Database Backup | Neup.Cloud',
};

type Props = {
    params: Promise<{ id: string }>
    searchParams?: Promise<{ selectedServer?: string }>;
}

export default async function DatabaseBackupPage({ params, searchParams }: Props) {
    const { id } = await params;
    const serverId = await resolveSelectedServerId(searchParams);

    if (!serverId) notFound();

    const parsedId = parseDatabaseRouteId(id);
    if (!parsedId) notFound();
    const { engine, dbName } = parsedId;

    let details = null;
    try {
        // Verify existence first
        details = await getDatabaseDetails(serverId, engine, dbName);
    } catch (error) {
        notFound();
    }

    return (
        <BackupClientPage
            serverId={serverId}
            engine={engine}
            dbName={dbName}
            databaseSize={details.size}
        />
    );
}

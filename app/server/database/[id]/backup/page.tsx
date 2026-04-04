
import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { BackupClientPage } from "./backup-client";
import { getDatabaseDetails } from "@/actions/database";
import type { Metadata } from "next";

export const metadata: Metadata = {
    title: 'Database Backup | Neup.Cloud',
};

type Props = {
    params: Promise<{ id: string }>
}

export default async function DatabaseBackupPage({ params }: Props) {
    const { id } = await params;
    const cookieStore = await cookies();
    const serverId = cookieStore.get('selected_server')?.value;

    if (!serverId) notFound();

    // Parse ID: Format is "engine-name"
    const parts = id.split('-');
    if (parts.length < 2) notFound();

    const engine = parts[0] as 'mariadb' | 'postgres';
    const dbName = parts.slice(1).join('-');

    try {
        // Verify existence first
        await getDatabaseDetails(serverId, engine, dbName);
    } catch (error) {
        notFound();
    }

    return (
        <BackupClientPage
            serverId={serverId}
            engine={engine}
            dbName={dbName}
        />
    );
}

import type { Metadata } from 'next';
import ProcessesClient from '@/app/(main)/server/status/processes/processes-client';
import { getServer } from '@/services/server/server-service';

export const metadata: Metadata = {
    title: 'Server Processes, Neup.Cloud',
};

export default async function StatusProcessesPage({
    searchParams,
}: {
    searchParams?: Promise<{ selectedServer?: string }>;
}) {
    const resolvedSearchParams = searchParams ? await searchParams : {};
    const serverId = resolvedSearchParams.selectedServer?.trim() || null;
    const serverName = serverId ? (await getServer(serverId))?.name ?? null : null;

    return (
        <ProcessesClient serverId={serverId ?? undefined} serverName={serverName ?? undefined} />
    );
}


import React from 'react';
import type { Metadata } from 'next';
import StatusClient from './status-client';
import { getServer } from '@/services/server/server-service';

export const metadata: Metadata = {
    title: 'Server Status, Neup.Cloud',
};

export default async function StatusPage({
    searchParams,
}: {
    searchParams?: Promise<{ selectedServer?: string }>;
}) {
    const resolvedSearchParams = searchParams ? await searchParams : {};
    const serverId = resolvedSearchParams.selectedServer?.trim() || null;
    const serverName = serverId ? (await getServer(serverId))?.name ?? null : null;

    return (
        <StatusClient serverId={serverId ?? undefined} serverName={serverName ?? undefined} />
    );
}

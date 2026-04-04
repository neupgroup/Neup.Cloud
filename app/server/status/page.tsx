
import React from 'react';
import { cookies } from 'next/headers';
import type { Metadata } from 'next';
import StatusClient from './status-client';

export const metadata: Metadata = {
    title: 'Server Status, Neup.Cloud',
};

export default async function StatusPage() {
    const cookieStore = await cookies();
    const serverId = cookieStore.get('selected_server')?.value;
    const serverName = cookieStore.get('selected_server_name')?.value;

    return (
        <StatusClient serverId={serverId} serverName={serverName} />
    );
}

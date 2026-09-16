import { cookies } from 'next/headers';
import { getServer } from '@/services/server/server-service';
import DefaultNginxConfigClient from './client';

export default async function DefaultNginxConfigPage({
    searchParams,
}: {
    searchParams?: Promise<{ selectedServer?: string }>;
}) {
    const resolvedSearchParams = searchParams ? await searchParams : {};
    const cookieStore = await cookies();
    const serverId = resolvedSearchParams.selectedServer?.trim() || cookieStore.get('selected_server')?.value;
    let serverName = 'No Server Selected';

    if (serverId) {
        const server = await getServer(serverId);
        if (server) {
            serverName = server.name;
        }
    }

    return (
        <DefaultNginxConfigClient
            serverId={serverId || ''}
            serverName={serverName}
        />
    );
}

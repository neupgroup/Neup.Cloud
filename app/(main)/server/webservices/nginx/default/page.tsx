import { cookies } from 'next/headers';
import { getServer } from '@/services/server/server-service';
import DefaultNginxConfigClient from './client';
import { withSelectedServerQuery } from '@/core/server-context';

export default async function DefaultNginxConfigPage({
    searchParams,
}: {
    searchParams?: Promise<{ selectedServer?: string }>;
}) {
    const resolvedSearchParams = searchParams ? await searchParams : {};
    const cookieStore = await cookies();
    const serverId = resolvedSearchParams.selectedServer?.trim() || cookieStore.get('selected_server')?.value;
    let serverName = 'No Server Selected';
    const backHref = withSelectedServerQuery('/server/webservices/nginx', serverId);

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
            backHref={backHref}
        />
    );
}

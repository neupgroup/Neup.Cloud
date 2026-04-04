import { cookies } from 'next/headers';
import { getServer } from '@/app/servers/actions';
import ClientTerminal from './client';
import { Metadata } from 'next';

export const metadata: Metadata = {
    title: "Live Terminal, Neup.Cloud",
};

export default async function LiveConsolePage() {
    const cookieStore = await cookies();
    const serverId = cookieStore.get('selected_server')?.value;
    const cookieServerName = cookieStore.get('selected_server_name')?.value;
    let serverName = cookieServerName || 'Mock Server';

    if (serverId && !cookieServerName) {
        const server = await getServer(serverId);
        if (server) {
            serverName = server.name;
        }
    }

    // Try to get existing session from cookie
    let sessionId = cookieStore.get('live_session_id')?.value;

    // If no active session cookie, generate a new one
    if (!sessionId) {
        sessionId = Math.random().toString(36).substring(2, 10);
    }

    return (
        <div className="h-[calc(100vh-4rem)] flex flex-col bg-zinc-950 text-green-500 font-mono text-sm p-4 rounded-lg border border-zinc-800 shadow-2xl overflow-hidden">
            <ClientTerminal
                sessionId={sessionId}
                serverId={serverId}
                serverName={serverName}
            />
        </div>
    );
}

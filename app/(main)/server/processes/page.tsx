import type { Metadata } from 'next';
import { PageTitle } from '@/components/page-header';
import { getServer } from '@/services/server/server-service';
import ProcessesNetworkContent from './processes-network-content';

export const metadata: Metadata = {
  title: 'Processes and Network, Neup.Cloud',
};

export default async function ServerProcessesPage({
  searchParams,
}: {
  searchParams?: Promise<{ selectedServer?: string }>;
}) {
  const resolvedSearchParams = searchParams ? await searchParams : {};
  const serverId = resolvedSearchParams.selectedServer?.trim() || null;
  const serverName = serverId ? (await getServer(serverId))?.name ?? null : null;

  return (
    <div className="space-y-8">
      <PageTitle
        title="Processes and Network"
        description="Monitor running CPU processes and active network connections on this server."
        serverName={serverName}
      />

      {!serverId ? (
        <div className="rounded-lg border p-8 text-center text-sm text-muted-foreground">
            Select a server to view its processes and network connections.
        </div>
      ) : (
        <ProcessesNetworkContent serverId={serverId} />
      )}
    </div>
  );
}

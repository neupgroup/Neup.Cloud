import { checkServerConnection, getSystemStats, getSystemUptime } from '@/services/server/server-service';
import { getAuthorizedServerId } from './_server';

export const serverStatusTool = {
  name: 'servers_single_status',
  description: 'Check SSH connectivity, CPU and memory usage, and uptime for a server.',
  inputSchema: {
    type: 'object',
    properties: {
      serverId: { type: 'string', description: 'Server ID, name, IP, or SSH host.' },
      serverName: { type: 'string', description: 'Server name; used when serverId is omitted.' },
    },
    additionalProperties: false,
  },
} as const;

// Gather current connection and runtime status for one account-accessible server.
export async function getServerStatusTool(input: Record<string, unknown>) {
  const serverIdentifier = input.serverId ?? input.serverName;
  if (typeof input.accountId !== 'string' || !input.accountId.trim()) throw new Error('Authentication required.');
  const serverId = await getAuthorizedServerId(serverIdentifier, input.accountId);

  const [connection, stats, uptime] = await Promise.all([
    checkServerConnection(serverId),
    getSystemStats(serverId),
    getSystemUptime(serverId),
  ]);

  return { serverId, connection, stats, uptime };
}

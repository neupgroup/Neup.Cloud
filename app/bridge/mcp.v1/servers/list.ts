import { getServers } from '@/services/server/server-service';

export const serversListTool = {
  name: 'servers_list',
  description: 'List servers available to the current account.',
  inputSchema: { type: 'object', properties: {}, additionalProperties: false },
} as const;

// List account-accessible servers using the service's public, credential-free shape.
export async function listServersTool(input: Record<string, unknown>) {
  const accountId = typeof input.accountId === 'string' ? input.accountId : undefined;
  return getServers(accountId);
}

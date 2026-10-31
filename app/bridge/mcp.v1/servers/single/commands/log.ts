import { prisma } from '@neup/core/database/prisma';
import { getAuthorizedServer } from '../_server';

export const serverCommandLogTool = {
  name: 'servers_single_commands_log',
  description: 'List recent command execution logs for an account-accessible server.',
  inputSchema: {
    type: 'object',
    properties: {
      serverId: { type: 'string' },
      limit: { type: 'integer', minimum: 1, maximum: 100 },
    },
    required: ['serverId'],
    additionalProperties: false,
  },
} as const;

// Return recent command logs after confirming the account can access the server.
export async function listServerCommandLogs(input: Record<string, unknown>) {
  if (typeof input.accountId !== 'string' || !input.accountId.trim()) throw new Error('Authentication required.');
  const server = await getAuthorizedServer(input.serverId, input.accountId);
  const limit = typeof input.limit === 'number' ? Math.max(1, Math.min(100, Math.floor(input.limit))) : 50;
  const logs = await prisma.serverLog.findMany({
    where: { serverId: server.id, accountId: input.accountId },
    orderBy: { runAt: 'desc' },
    take: limit,
    select: { id: true, command: true, commandName: true, output: true, status: true, runAt: true, source: true },
  });
  return logs.map((log) => ({ ...log, runAt: log.runAt.toISOString() }));
}

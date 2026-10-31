import { runCommandOnServer } from '@/services/server/ssh';
import { getAuthorizedServer, quoteShellArgument } from '../_server';

export const serverFileViewTool = {
  name: 'servers_single_files_view',
  description: 'Read a UTF-8 text file from an account-accessible server.',
  inputSchema: {
    type: 'object',
    properties: { serverId: { type: 'string' }, path: { type: 'string' } },
    required: ['serverId', 'path'],
    additionalProperties: false,
  },
} as const;

// Read a bounded amount of a remote text file without allowing path injection.
export async function viewServerFile(input: Record<string, unknown>) {
  if (typeof input.accountId !== 'string' || !input.accountId.trim()) throw new Error('Authentication required.');
  if (typeof input.path !== 'string' || !input.path.trim()) throw new Error('path must be a non-empty string.');

  const server = await getAuthorizedServer(input.serverId, input.accountId);
  const filePath = input.path.trim();
  const command = `test -f ${quoteShellArgument(filePath)} && head -c 262144 ${quoteShellArgument(filePath)}`;
  const result = await runCommandOnServer(server.publicIp, server.username, server.privateKey, command, undefined, undefined, true, {});
  if (result.code !== 0) throw new Error(result.stderr || 'Unable to read the requested file.');
  return { path: filePath, content: result.stdout, truncated: result.stdout.length >= 262144 };
}

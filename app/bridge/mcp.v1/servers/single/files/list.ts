import { runCommandOnServer } from '@/services/server/ssh';
import { getAuthorizedServer, quoteShellArgument } from '../_server';

export const serverFilesListTool = {
  name: 'servers_single_files_list',
  description: 'List files and directories at a server path (defaults to the SSH user home directory).',
  inputSchema: {
    type: 'object',
    properties: {
      serverId: { type: 'string' },
      path: { type: 'string', description: 'Directory path to list.' },
    },
    required: ['serverId'],
    additionalProperties: false,
  },
} as const;

// List a remote directory using a safely quoted path and account-scoped server access.
export async function listServerFiles(input: Record<string, unknown>) {
  if (typeof input.accountId !== 'string' || !input.accountId.trim()) throw new Error('Authentication required.');
  const server = await getAuthorizedServer(input.serverId, input.accountId);
  const targetPath = typeof input.path === 'string' && input.path.trim() ? input.path.trim() : '~';
  const command = `find ${quoteShellArgument(targetPath)} -mindepth 1 -maxdepth 1 -printf '%f\\t%y\\t%s\\t%TY-%Tm-%Td %TH:%TM:%TS\\n' 2>/dev/null | sort`;
  const result = await runCommandOnServer(server.publicIp, server.username, server.privateKey, command, undefined, undefined, true, {});
  if (result.code !== 0) throw new Error(result.stderr || 'Failed to list server files.');

  return (result.stdout || '').split('\n').filter(Boolean).map((line) => {
    const [name, kind, size, modifiedAt] = line.split('\t');
    return { name, type: kind === 'd' ? 'directory' : kind === 'l' ? 'symlink' : 'file', size: Number(size), modifiedAt };
  });
}

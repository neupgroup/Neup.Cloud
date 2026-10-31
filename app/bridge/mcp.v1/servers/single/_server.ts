import { getServerByIdentifier } from '@/services/server/data';

// Resolve a server identifier only when the authenticated account has active access.
export async function getAuthorizedServer(serverIdentifier: unknown, accountId: string) {
  if (typeof serverIdentifier !== 'string' || !serverIdentifier.trim()) {
    throw new Error('serverId must be a non-empty string.');
  }

  const server = await getServerByIdentifier(serverIdentifier.trim(), accountId);
  if (!server) throw new Error('Server not found or not accessible to this account.');
  if (!server.username) throw new Error('Server is missing SSH access configuration.');
  return server;
}

// Resolve a server name, ID, or host to its canonical ID after checking account access.
export async function getAuthorizedServerId(serverIdentifier: unknown, accountId: string) {
  const server = await getAuthorizedServer(serverIdentifier, accountId);
  return server.id;
}

// Quote a value for safe use as one POSIX shell argument.
export function quoteShellArgument(value: string) {
  return `'${value.replace(/'/g, `'\\''`)}'`;
}

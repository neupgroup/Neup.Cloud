

'use server';


import { revalidatePath } from 'next/cache';
import { cookies } from 'next/headers';
import { promisify } from 'node:util';
import { execFile as execFileCallback } from 'node:child_process';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  createServer as createServerRecord,
  deleteServer as deleteServerRecord,
  getServerById,
  getServers as getServersData,
  toPublicServer,
  updateServer as updateServerRecord,
} from '@/services/server/data';
import {
  getRamUsage as getRamUsageLogic,
  getServerForRunner as getServerForRunnerLogic,
  getServerMemory as getServerMemoryLogic,
  getSystemStats as getSystemStatsLogic,
  getSystemUptime as getSystemUptimeLogic,
} from '@/services/server/server-runtime';
import { runCommandOnServer } from '@/services/server/ssh';
import { getServerSshPassphrase } from '@/services/server/server-metadata';
const execFile = promisify(execFileCallback);

export async function getSystemStats(serverId: string) {
  return getSystemStatsLogic(serverId);
}

export async function getRamUsage(serverId: string) {
  return getRamUsageLogic(serverId);
}

export async function getSystemUptime(serverId: string) {
  return getSystemUptimeLogic(serverId);
}

export async function getServerMemory(serverId: string) {
  return getServerMemoryLogic(serverId);
}

export async function createServer(serverData: {
  name: string;
  username: string;
  type: string;
  provider: string;
  moreDetails?: string;
  publicIp: string;
  privateIp: string;
  privateKey: string;
  publicKey?: string;
}) {
  await createServerRecord(serverData);
  revalidatePath('/server/list');
}

export async function updateServer(
  id: string,
  serverData: Partial<{
    name: string;
    username: string;
    type: string;
    provider: string;
    moreDetails: string;
    publicIp: string;
    privateIp: string;
    privateKey: string;
    publicKey: string;
    proxyHandler: string;
    loadBalancer: string;
  }>
) {
  const filteredData = Object.fromEntries(
    Object.entries(serverData).filter(([key, value]) => {
      if ((key === 'privateIp' || key === 'privateKey') && (value === '' || value === undefined)) {
        return false;
      }

      return value !== undefined;
    })
  );

  if (Object.keys(filteredData).length === 0) {
    return;
  }

  await updateServerRecord(id, filteredData);
  revalidatePath(`/server/list/${id}`);
  revalidatePath('/server/list');
}

export async function deleteServer(id: string) {
  await deleteServerRecord(id);
  revalidatePath('/server/list');
}

export async function selectServer(serverId: string, serverName: string) {
  // Only use cookies and revalidatePath in server context
  const cookieStore = await cookies();
  cookieStore.set('selected_server', serverId);
  cookieStore.set('selected_server_name', serverName);
  revalidatePath('/');
  revalidatePath('/server/list');
  return { success: true };
}

export async function getServers() {
  const servers = await getServersData();
  return servers.map(toPublicServer);
}

export async function getServer(id: string) {
  const server = await getServerById(id);
  return server ? toPublicServer(server) : null;
}

export async function getServerForRunner(id: string) {
  return getServerForRunnerLogic(id);
}

export async function checkServerConnection(
  serverId: string
): Promise<{
  success: boolean;
  message: string;
  checkedAt?: string;
}> {
  if (!serverId?.trim()) {
    throw new Error('Server ID is required.');
  }

  const server = await getServerById(serverId);

  if (!server) {
    throw new Error('Server not found.');
  }

  if (!server.username || !server.privateKey) {
    throw new Error('Server is missing username or private key configuration for SSH access.');
  }

  const sshPassphrase = getServerSshPassphrase(server.moreDetails);

  try {
    const result = await runCommandOnServer(
      server.publicIp,
      server.username,
      server.privateKey,
      'echo "Connection test successful"',
      undefined,
      undefined,
      false,
      {},
      sshPassphrase ?? undefined
    );

    if (result.code !== 0) {
      return {
        success: false,
        message: result.stderr || 'Connection test failed.',
        checkedAt: new Date().toISOString(),
      };
    }

    return {
      success: true,
      message: 'Connection is active and reachable.',
      checkedAt: new Date().toISOString(),
    };
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Connection check failed.',
      checkedAt: new Date().toISOString(),
    };
  }
}

export async function generateSshKeyPair(input?: {
  name?: string;
  algorithm?: 'ed25519' | 'rsa' | 'ecdsa';
  passphrase?: string;
}) {
  const tempDir = await mkdtemp(join(tmpdir(), 'neup-ssh-keygen-'));
  const keyPath = join(tempDir, 'id_ed25519');
  const algorithm = input?.algorithm ?? 'ed25519';
  const passphrase = input?.passphrase ?? '';
  const comment = input?.name?.trim() || 'neup-cloud';
  const args = ['-t', algorithm, '-N', passphrase, '-C', comment, '-f', keyPath, '-q'];

  if (algorithm === 'rsa') {
    args.splice(2, 0, '-b', '4096');
  }

  if (algorithm === 'ecdsa') {
    args.splice(2, 0, '-b', '521');
  }

  try {
    await execFile('ssh-keygen', args);

    const [privateKey, publicKey] = await Promise.all([
      readFile(keyPath, 'utf8'),
      readFile(`${keyPath}.pub`, 'utf8'),
    ]);

    return {
      privateKey: privateKey.trim(),
      publicKey: publicKey.trim(),
    };
  } catch (error) {
    throw new Error(
      error instanceof Error
        ? `Failed to generate SSH key pair: ${error.message}`
        : 'Failed to generate SSH key pair.'
    );
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
}

'use server';

import { revalidatePath } from 'next/cache';
import { cookies } from 'next/headers';
import { runCommandOnServer } from '@/services/ssh';
import { createRecordId, queryAppDb } from '@/lib/app-db';

type ServerRecord = {
  id: string;
  name: string;
  username: string;
  type: string;
  provider: string;
  ram: string | null;
  storage: string | null;
  publicIp: string;
  privateIp: string | null;
  privateKey: string | null;
  proxyHandler: string | null;
  loadBalancer: string | null;
  createdAt: Date;
  updatedAt: Date;
};

function toPublicServer(server: ServerRecord) {
  const { privateKey, ...serverData } = server;
  return serverData;
}

export async function selectServer(serverId: string, serverName: string) {
  const cookieStore = await cookies();
  cookieStore.set('selected_server', serverId);
  cookieStore.set('selected_server_name', serverName);
  revalidatePath('/');
  return { success: true };
}

export async function getServers() {
  const result = await queryAppDb<ServerRecord>(`
    SELECT *
    FROM servers
    ORDER BY name ASC
  `);

  return result.rows.map(toPublicServer);
}

export async function getServer(id: string) {
  const result = await queryAppDb<ServerRecord>(`
    SELECT *
    FROM servers
    WHERE id = $1
    LIMIT 1
  `, [id]);

  const server = result.rows[0];
  return server ? toPublicServer(server) : null;
}

export async function getServerForRunner(id: string) {
  const result = await queryAppDb<ServerRecord>(`
    SELECT *
    FROM servers
    WHERE id = $1
    LIMIT 1
  `, [id]);

  return result.rows[0] ?? null;
}

export async function getRamUsage(serverId: string) {
  const server = await getServerForRunner(serverId);
  if (!server) {
    return { error: 'Server not found.' };
  }
  if (!server.username || !server.privateKey) {
    return { error: 'Server is missing username or private key configuration for SSH access.' };
  }

  try {
    const result = await runCommandOnServer(server.publicIp, server.username, server.privateKey, 'ps -eo rss=');
    if (result.code !== 0) {
      return { error: result.stderr || 'Failed to get RAM usage.' };
    }

    const lines = result.stdout.trim().split('\n');
    const totalRamKb = lines.reduce((sum, line) => {
      const ram = parseInt(line.trim(), 10);
      return sum + (isNaN(ram) ? 0 : ram);
    }, 0);

    const usedRam = Math.round(totalRamKb / 1024);
    return { usedRam };
  } catch (error: any) {
    return { error: error.message };
  }
}

export async function getSystemStats(serverId: string) {
  const server = await getServerForRunner(serverId);
  if (!server) {
    return { error: 'Server not found.' };
  }
  if (!server.username || !server.privateKey) {
    return { error: 'Server is missing username or private key configuration for SSH access.' };
  }

  try {
    const cmd = `
    vmstat 1 2 | tail -1 | awk '{print 100 - $15}'
    echo "---"
    free -m | awk 'NR==2{print $2 " " $3}'
    `;

    const result = await runCommandOnServer(server.publicIp, server.username, server.privateKey, cmd);
    if (result.code !== 0) {
      return { error: result.stderr || 'Failed to get system stats.' };
    }

    const [cpuLine, ramLine] = result.stdout.trim().split('---');
    const cpuUsage = parseFloat(cpuLine.trim());
    const [totalRam, usedRam] = ramLine.trim().split(' ').map(Number);

    return {
      cpuUsage: isNaN(cpuUsage) ? 0 : cpuUsage,
      memory: {
        total: totalRam,
        used: usedRam,
        percentage: totalRam > 0 ? Math.round((usedRam / totalRam) * 100) : 0,
      },
    };
  } catch (error: any) {
    return { error: error.message };
  }
}

export async function getSystemUptime(serverId: string) {
  const server = await getServerForRunner(serverId);
  if (!server) {
    return { error: 'Server not found.' };
  }
  if (!server.username || !server.privateKey) {
    return { error: 'Server is missing username or private key configuration for SSH access.' };
  }

  try {
    const result = await runCommandOnServer(server.publicIp, server.username, server.privateKey, 'cat /proc/uptime');
    if (result.code !== 0) {
      return { error: result.stderr || 'Failed to get uptime.' };
    }

    const seconds = parseFloat(result.stdout.trim().split(/\s+/)[0]);
    if (isNaN(seconds)) {
      return { error: 'Could not parse uptime data.' };
    }

    const d = Math.floor(seconds / (3600 * 24));
    const h = Math.floor((seconds % (3600 * 24)) / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const parts = [];

    if (d > 0) parts.push(`${d}d`);
    if (h > 0) parts.push(`${h}h`);
    if (m > 0 || parts.length === 0) parts.push(`${m}m`);

    return { uptime: parts.join(' ') };
  } catch (error: any) {
    return { error: error.message };
  }
}

export async function getServerMemory(serverId: string) {
  const server = await getServerForRunner(serverId);
  if (!server) {
    return { error: 'Server not found.' };
  }
  if (!server.username || !server.privateKey) {
    return { error: 'Server is missing username or private key configuration for SSH access.' };
  }

  try {
    const result = await runCommandOnServer(
      server.publicIp,
      server.username,
      server.privateKey,
      "grep -E 'MemTotal|MemAvailable' /proc/meminfo"
    );

    if (result.code !== 0) {
      return { error: `Failed to fetch memory info: ${result.stderr}` };
    }

    const totalMatch = result.stdout.match(/MemTotal:\s+(\d+)\s+kB/);
    const availMatch = result.stdout.match(/MemAvailable:\s+(\d+)\s+kB/);

    if (!totalMatch) {
      return { error: 'Could not parse MemTotal' };
    }

    const totalKb = parseInt(totalMatch[1], 10);
    const availableKb = availMatch ? parseInt(availMatch[1], 10) : 0;

    return {
      totalKb,
      availableKb,
      ram: {
        total: totalKb,
        available: availableKb,
      },
    };
  } catch (error: any) {
    return { error: error.message };
  }
}

export async function createServer(serverData: {
  name: string;
  username: string;
  type: string;
  provider: string;
  ram?: string;
  storage?: string;
  publicIp: string;
  privateIp: string;
  privateKey: string;
}) {
  await queryAppDb(`
    INSERT INTO servers (
      id,
      name,
      username,
      type,
      provider,
      ram,
      storage,
      "publicIp",
      "privateIp",
      "privateKey",
      "createdAt",
      "updatedAt"
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW(), NOW())
  `, [
    createRecordId(),
    serverData.name,
    serverData.username,
    serverData.type,
    serverData.provider,
    serverData.ram ?? null,
    serverData.storage ?? null,
    serverData.publicIp,
    serverData.privateIp,
    serverData.privateKey,
  ]);

  revalidatePath('/servers');
}

export async function updateServer(
  id: string,
  serverData: Partial<{
    name: string;
    username: string;
    type: string;
    provider: string;
    ram: string;
    storage: string;
    publicIp: string;
    privateIp: string;
    privateKey: string;
    proxyHandler: string;
    loadBalancer: string;
  }>
) {
  const fieldMap: Record<string, string> = {
    name: 'name',
    username: 'username',
    type: 'type',
    provider: 'provider',
    ram: 'ram',
    storage: 'storage',
    publicIp: '"publicIp"',
    privateIp: '"privateIp"',
    privateKey: '"privateKey"',
    proxyHandler: '"proxyHandler"',
    loadBalancer: '"loadBalancer"',
  };

  const entries = Object.entries(serverData).filter(([key, value]) => {
    if ((key === 'privateIp' || key === 'privateKey') && (value === '' || value === undefined)) {
      return false;
    }

    return value !== undefined;
  });

  if (entries.length === 0) {
    return;
  }

  const values = entries.map(([, value]) => value);
  const assignments = entries.map(([key], index) => `${fieldMap[key]} = $${index + 2}`);

  await queryAppDb(`
    UPDATE servers
    SET ${assignments.join(', ')}, "updatedAt" = NOW()
    WHERE id = $1
  `, [id, ...values]);

  revalidatePath(`/servers/${id}`);
  revalidatePath('/servers');
}

export async function deleteServer(id: string) {
  await queryAppDb(`
    DELETE FROM servers
    WHERE id = $1
  `, [id]);

  revalidatePath('/servers');
}

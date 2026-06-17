import { runCommandOnServer } from '@/services/server/ssh';
import { createServerLog } from '@/services/logs/server';
import { getServerByIdentifier } from '@/services/server/data';
import { getServerSshPassphrase } from '@/services/server/server-metadata';

export async function getServerForRunner(id: string) {
  return getServerByIdentifier(id);
}

export async function getRamUsage(serverId: string) {
  const server = await getServerForRunner(serverId);
  if (!server) {
    return { error: 'Server not found.' };
  }
  if (!server.username || !server.privateKey) {
    return { error: 'Server is missing username or private key configuration for SSH access.' };
  }

  const sshPassphrase = getServerSshPassphrase(server.moreDetails);

  try {
    const result = await runCommandOnServer(server.publicIp, server.username, server.privateKey, 'ps -eo rss=', undefined, undefined, false, {}, sshPassphrase ?? undefined);
    if (result.code !== 0) {
      return { error: result.stderr || 'Failed to get RAM usage.' };
    }

    const totalRamKb = result.stdout
      .trim()
      .split('\n')
      .reduce((sum, line) => {
        const value = parseInt(line.trim(), 10);
        return sum + (isNaN(value) ? 0 : value);
      }, 0);

    return { usedRam: Math.round(totalRamKb / 1024) };
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

  const sshPassphrase = getServerSshPassphrase(server.moreDetails);

  try {
    const command = `
    vmstat 1 2 | tail -1 | awk '{print 100 - $15}'
    echo "---"
    free -m | awk 'NR==2{print $2 " " $3}'
    `;

    const result = await runCommandOnServer(server.publicIp, server.username, server.privateKey, command, undefined, undefined, false, {}, sshPassphrase ?? undefined);
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

  const sshPassphrase = getServerSshPassphrase(server.moreDetails);

  try {
    const result = await runCommandOnServer(server.publicIp, server.username, server.privateKey, 'cat /proc/uptime', undefined, undefined, false, {}, sshPassphrase ?? undefined);
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

  const sshPassphrase = getServerSshPassphrase(server.moreDetails);

  try {
    const result = await runCommandOnServer(
      server.publicIp,
      server.username,
      server.privateKey,
      "grep -E 'MemTotal|MemAvailable' /proc/meminfo",
      undefined,
      undefined,
      false,
      {},
      sshPassphrase ?? undefined
    );

    if (result.code !== 0) {
      return { error: `Failed to fetch memory info: ${result.stderr}` };
    }

    const totalMatch = result.stdout.match(/MemTotal:\s+(\d+)\s+kB/);
    const availableMatch = result.stdout.match(/MemAvailable:\s+(\d+)\s+kB/);

    if (!totalMatch) {
      return { error: 'Could not parse MemTotal' };
    }

    const totalKb = parseInt(totalMatch[1], 10);
    const availableKb = availableMatch ? parseInt(availableMatch[1], 10) : 0;

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

export async function runCustomCommandOnServer(serverId: string, command: string) {
  if (!serverId || !command) {
    return { error: 'Server and command are required.' };
  }

  const server = await getServerForRunner(serverId);
  if (!server) {
    return { error: 'Server not found.' };
  }
  if (!server.username || !server.privateKey) {
    return { error: 'No username or private key configured for this server.' };
  }

  const sshPassphrase = getServerSshPassphrase(server.moreDetails);

  try {
    const result = await runCommandOnServer(
      server.publicIp,
      server.username,
      server.privateKey,
      command
      ,
      undefined,
      undefined,
      false,
      {},
      sshPassphrase ?? undefined
    );

    const output = result.code === 0 ? result.stdout : result.stderr;
    const status = result.code === 0 ? 'Success' : 'Error';

    await createServerLog({
      serverId,
      command,
      output,
      status,
      source: 'commands:custom',
    });

    return { output: output || `Command executed with status code ${result.code}.` };
  } catch (error: any) {
    await createServerLog({
      serverId,
      command,
      output: error.message,
      status: 'Error',
      source: 'commands:custom',
    });

    return { error: `Failed to execute command: ${error.message}` };
  }
}

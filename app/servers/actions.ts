'use server';

import { revalidatePath } from 'next/cache';
import { cookies } from 'next/headers';
import {
  createServer as createServerRecord,
  deleteServer as deleteServerRecord,
  getServerById,
  getServers as getServersData,
  toPublicServer,
  updateServer as updateServerRecord,
} from '@/services/servers/data';
import {
  getRamUsage as getRamUsageLogic,
  getServerForRunner as getServerForRunnerLogic,
  getServerMemory as getServerMemoryLogic,
  getSystemStats as getSystemStatsLogic,
  getSystemUptime as getSystemUptimeLogic,
} from '@/services/servers/logic';

export async function selectServer(serverId: string, serverName: string) {
  const cookieStore = await cookies();
  cookieStore.set('selected_server', serverId);
  cookieStore.set('selected_server_name', serverName);
  revalidatePath('/');
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

export async function getRamUsage(serverId: string) {
  return getRamUsageLogic(serverId);
}

export async function getSystemStats(serverId: string) {
  return getSystemStatsLogic(serverId);
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
  ram?: string;
  storage?: string;
  moreDetails?: string;
  publicIp: string;
  privateIp: string;
  privateKey: string;
}) {
  await createServerRecord(serverData);
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
    moreDetails: string;
    publicIp: string;
    privateIp: string;
    privateKey: string;
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
  revalidatePath(`/servers/${id}`);
  revalidatePath('/servers');
}

export async function deleteServer(id: string) {
  await deleteServerRecord(id);
  revalidatePath('/servers');
}

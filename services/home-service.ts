'use server';

import { getRecentServerLogs } from '@/services/logs/server';

export type ActivityLog = {
  id: string;
  command: string;
  commandName?: string;
  source?: string | null;
  status: 'Success' | 'Error' | 'pending';
  runAt: number;
  serverId: string;
  serverName?: string;
};

export async function getRecentActivity(serverId?: string): Promise<ActivityLog[]> {
  try {
    const logs = await getRecentServerLogs(serverId);

    return logs.map((log) => ({
      id: log.id,
      command: log.command,
      commandName: log.commandName ?? undefined,
      source: log.source ?? null,
      status: log.status as ActivityLog['status'],
      runAt: log.runAt.getTime(),
      serverId: log.serverId,
    }));
  } catch (error) {
    console.error('Error fetching recent activity:', error);
    return [];
  }
}

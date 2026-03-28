'use server';

import { queryAppDb } from '@/lib/app-db';

export type ActivityLog = {
  id: string;
  command: string;
  commandName?: string;
  status: 'Success' | 'Error' | 'pending';
  runAt: number;
  serverId: string;
  serverName?: string;
};

type ServerLogRow = {
  id: string;
  command: string;
  commandName: string | null;
  status: 'Success' | 'Error' | 'pending';
  runAt: Date;
  serverId: string;
};

export async function getRecentActivity(serverId?: string): Promise<ActivityLog[]> {
  try {
    const result = serverId
      ? await queryAppDb<ServerLogRow>(`
          SELECT id, command, "commandName", status, "runAt", "serverId"
          FROM server_logs
          WHERE "serverId" = $1
          ORDER BY "runAt" DESC
          LIMIT 10
        `, [serverId])
      : await queryAppDb<ServerLogRow>(`
          SELECT id, command, "commandName", status, "runAt", "serverId"
          FROM server_logs
          ORDER BY "runAt" DESC
          LIMIT 10
        `);

    return result.rows.map((row) => ({
      id: row.id,
      command: row.command,
      commandName: row.commandName ?? undefined,
      status: row.status,
      runAt: row.runAt.getTime(),
      serverId: row.serverId,
    }));
  } catch (error) {
    console.error('Error fetching recent activity:', error);
    return [];
  }
}

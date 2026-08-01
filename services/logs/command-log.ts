'use server';

import { prisma } from '@/core/database/prisma';
import { stripToMainOutput, hasMainMarkers } from '@/services/saved-commands/saved-commands-service';

export type CommandLogFilter = {
  serverId?: string | null;
  accountId?: string | null;
  source?: string | null;
  status?: string | null;
  from?: Date | null;
  to?: Date | null;
  limit?: number | null;
  offset?: number | null;
};

export type CommandLog = {
  id: string;
  serverId: string;
  command: string;
  commandName?: string;
  output?: string;
  status: 'Success' | 'Error' | 'pending';
  runAt: string;
  source?: string | null;
  accountId?: string | null;
};

export async function getCommandLog(filter: CommandLogFilter): Promise<CommandLog[]> {
  const where: Record<string, any> = {};

  if (filter.serverId) where.serverId = filter.serverId;
  if (filter.accountId) where.accountId = filter.accountId;
  if (filter.source) where.source = { startsWith: filter.source };
  if (filter.status) where.status = filter.status;

  if (filter.from || filter.to) {
    where.runAt = {
      ...(filter.from ? { gte: filter.from } : {}),
      ...(filter.to ? { lte: filter.to } : {}),
    };
  }

  const logs = await prisma.serverLog.findMany({
    where,
    orderBy: { runAt: 'desc' },
    ...(filter.limit ? { take: filter.limit } : {}),
    ...(filter.offset ? { skip: filter.offset } : {}),
  });

  return logs.map((log: any) => {
    const rawOutput = log.output ?? undefined;
    const output = rawOutput && hasMainMarkers(rawOutput) ? stripToMainOutput(rawOutput) : rawOutput;
    return {
      id: log.id,
      serverId: log.serverId,
      command: log.command,
      commandName: log.commandName ?? undefined,
      output,
      status: log.status as 'Success' | 'Error' | 'pending',
      runAt: log.runAt.toISOString(),
      source: log.source ?? null,
      accountId: log.accountId ?? null,
    };
  });
}

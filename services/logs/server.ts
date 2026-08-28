import { stringUuid } from '#/core/data/uuid';
import { prisma } from '#/core/database/prisma';
import { getCurrentAccountId } from '@/services/account-profile';

export async function createServerLog(data: {
  serverId: string;
  command: string;
  commandName?: string | null;
  output?: string | null;
  status: string;
  runAt?: Date;
  source?: string | null;
  accountId?: string | null;
}) {
  const accountId = data.accountId ?? await getCurrentAccountId();

  return prisma.serverLog.create({
    data: {
      id: stringUuid(),
      serverId: data.serverId,
      command: data.command,
      commandName: data.commandName ?? null,
      output: data.output ?? null,
      status: data.status,
      runAt: data.runAt ?? new Date(),
      source: data.source ?? null,
      accountId,
    },
  });
}

export async function updateServerLog(id: string, data: {
  commandName?: string | null;
  output?: string | null;
  status?: string;
}) {
  return prisma.serverLog.update({
    where: { id },
    data: {
      ...(data.commandName !== undefined ? { commandName: data.commandName } : {}),
      ...(data.output !== undefined ? { output: data.output } : {}),
      ...(data.status !== undefined ? { status: data.status } : {}),
    },
  });
}

export async function getServerLogById(id: string) {
  return prisma.serverLog.findUnique({
    where: { id },
  });
}

export async function getRecentServerLogs(serverId?: string) {
  return prisma.serverLog.findMany({
    where: serverId ? { serverId } : undefined,
    orderBy: { runAt: 'desc' },
    take: 10,
  });
}

export async function getServerLogsByServerId(serverId: string) {
  return prisma.serverLog.findMany({
    where: { serverId },
    orderBy: { runAt: 'desc' },
  });
}

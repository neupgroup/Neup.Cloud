import { prisma } from '#/core/database/prisma';
import type { Prisma } from '@/prisma/client';

function normalizeHistory(history: unknown): Record<string, unknown> {
  if (!history || typeof history !== 'object' || Array.isArray(history)) {
    return {};
  }

  return history as Record<string, unknown>;
}

export async function getLiveSessionById(id: string) {
  return prisma.liveSession.findUnique({
    where: { id },
  });
}

export async function createLiveSession(data: {
  id: string;
  serverLogId?: string | null;
  serverId?: string | null;
}) {
  return prisma.liveSession.create({
    data: {
      id: data.id,
      createdAt: new Date(),
      cwd: '~',
      status: 'active',
      history: {},
      serverLogId: data.serverLogId ?? null,
      serverId: data.serverId ?? null,
    },
  });
}

export async function updateLiveSession(id: string, data: {
  cwd?: string;
  status?: string;
}) {
  return prisma.liveSession.update({
    where: { id },
    data: {
      ...(data.cwd !== undefined ? { cwd: data.cwd } : {}),
      ...(data.status !== undefined ? { status: data.status } : {}),
    },
  });
}

export async function getLiveSessionHistory(id: string) {
  const session = await getLiveSessionById(id);
  return normalizeHistory(session?.history);
}

export async function updateLiveSessionHistory(
  id: string,
  updater: (history: Record<string, unknown>) => Record<string, unknown>
) {
  const history = await getLiveSessionHistory(id);

  return prisma.liveSession.update({
    where: { id },
    data: {
      history: updater(history) as Prisma.InputJsonValue,
    },
  });
}

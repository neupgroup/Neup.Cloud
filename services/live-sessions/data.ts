import { prisma } from '@/core/database/prisma';

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
      history: [],
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

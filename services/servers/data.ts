import { prisma } from '@/services/prisma';
import { createId } from '@/services/shared/create-id';

export function toPublicServer(server: Awaited<ReturnType<typeof prisma.server.findUnique>> extends infer T ? Exclude<T, null> : never) {
  const { privateKey, ...publicServer } = server;
  return publicServer;
}

export async function getServers() {
  return prisma.server.findMany({
    orderBy: { name: 'asc' },
  });
}

export async function getServerById(id: string) {
  return prisma.server.findUnique({
    where: { id },
  });
}

export async function createServer(data: {
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
  return prisma.server.create({
    data: {
      id: createId(),
      ...data,
      ram: data.ram ?? null,
      storage: data.storage ?? null,
      moreDetails: data.moreDetails ?? null,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  });
}

export async function updateServer(id: string, data: Partial<{
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
}>) {
  return prisma.server.update({
    where: { id },
    data: {
      ...data,
      updatedAt: new Date(),
    },
  });
}

export async function deleteServer(id: string) {
  return prisma.server.delete({
    where: { id },
  });
}

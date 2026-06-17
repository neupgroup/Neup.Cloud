import { prisma } from '@/services/prisma';
import { createId } from '@/core/create-id';
import { getServerSelectionCandidates } from '@/core/server-context';
import { stripSensitiveServerMetadata } from '@/services/server/server-metadata';

export function toPublicServer<
  T extends {
    privateKey?: string | null;
    moreDetails?: string | null;
  }
>(server: T): Omit<T, 'privateKey' | 'moreDetails'> & { moreDetails: string | null } {
  const { privateKey, moreDetails, ...publicServer } = server;
  return {
    ...publicServer,
    moreDetails: stripSensitiveServerMetadata(moreDetails),
  } as Omit<T, 'privateKey' | 'moreDetails'> & { moreDetails: string | null };
}

export async function getServers() {
  return prisma.server.findMany({
    orderBy: { name: 'asc' },
  });
}

export async function getServersWithRunningApplications() {
  const servers = await prisma.server.findMany({
    include: {
      applicationServerMaps: {
        orderBy: [{ application: { name: 'asc' } }],
        select: {
          id: true,
          status: true,
          isPrimary: true,
          application: {
            select: {
              id: true,
              name: true,
              appIcon: true,
            },
          },
        },
      },
    },
    orderBy: { name: 'asc' },
  });

  return servers.map(toPublicServer);
}

export async function getServerById(id: string) {
  return prisma.server.findUnique({
    where: { id },
  });
}

export async function getServerByIdentifier(identifier: string) {
  const candidates = getServerSelectionCandidates(identifier);
  if (candidates.length === 0) {
    return null;
  }

  return prisma.server.findFirst({
    where: {
      OR: candidates.flatMap((candidate) => ([
        { id: candidate },
        { publicIp: candidate },
        { privateIp: candidate },
        { name: candidate },
      ])),
    },
  });
}

export async function createServer(data: {
  name: string;
  username: string;
  type: string;
  provider: string;
  moreDetails?: string;
  publicIp: string;
  privateIp: string;
  privateKey: string;
  publicKey?: string;
}) {
  return prisma.server.create({
    data: {
      id: createId(),
      ...data,
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
  moreDetails: string;
  publicIp: string;
  privateIp: string;
  privateKey: string;
  publicKey: string;
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

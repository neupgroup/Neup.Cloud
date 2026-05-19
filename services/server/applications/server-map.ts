'use server';

import { createId } from '@/core/create-id';
import { prisma } from '@/services/prisma';

export type ApplicationServerStatus = 'stopped' | 'started' | 'inactive';

export type ApplicationServerMapRow = {
  id: string;
  serverId: string;
  serverName: string;
  status: ApplicationServerStatus;
  isPrimary: boolean;
  isSelected: boolean;
};

export type ApplicationRunningSection = {
  title: 'Running in' | 'Also Running in';
  servers: ApplicationServerMapRow[];
};

function toStatusValue(status: ApplicationServerStatus) {
  if (status === 'started') return 'started';
  if (status === 'stopped') return 'stopped';
  return 'inactive';
}

function normalizeRows(
  rows: Array<{
    id: string;
    serverId: string;
    status: string;
    isPrimary: boolean;
    server: { id: string; name: string };
  }>,
  selectedServerId?: string | null
): ApplicationServerMapRow[] {
  return rows.map((row) => ({
    id: row.id,
    serverId: row.serverId,
    serverName: row.server.name,
    status: row.status as ApplicationServerStatus,
    isPrimary: row.isPrimary,
    isSelected: !!selectedServerId && row.serverId === selectedServerId,
  }));
}

function resolveRunningSection(
  rows: ApplicationServerMapRow[],
  selectedServerId?: string | null
): ApplicationRunningSection | null {
  const runningRows = rows.filter((row) => row.status === 'started');
  if (runningRows.length === 0) return null;

  if (!selectedServerId) {
    return { title: 'Running in', servers: runningRows };
  }

  const selectedRow = rows.find((row) => row.serverId === selectedServerId);
  const selectedIsRunning = selectedRow?.status === 'started';

  if (!selectedIsRunning) {
    const runningElsewhere = runningRows.filter((row) => row.serverId !== selectedServerId);
    if (runningElsewhere.length === 0) return null;
    return { title: 'Running in', servers: runningElsewhere };
  }

  const alsoRunning = runningRows.filter((row) => row.serverId !== selectedServerId);
  if (alsoRunning.length === 0) return null;

  return { title: 'Also Running in', servers: alsoRunning };
}

export async function ensureInitialApplicationServerMap(applicationId: string, serverId?: string | null) {
  if (!serverId) return;

  await prisma.$transaction(async (tx: any) => {
    const existing = await tx.applicationServerMap.findUnique({
      where: {
        applicationId_serverId: {
          applicationId,
          serverId,
        },
      },
      select: { id: true },
    });

    if (existing) return;

    const count = await tx.applicationServerMap.count({ where: { applicationId } });

    await tx.applicationServerMap.create({
      data: {
        id: createId(),
        applicationId,
        serverId,
        status: 'started',
        isPrimary: count === 0,
      },
    });
  });
}

export async function upsertApplicationServerStatus(
  applicationId: string,
  serverId: string,
  status: ApplicationServerStatus
) {
  await prisma.$transaction(async (tx: any) => {
    const existing = await tx.applicationServerMap.findUnique({
      where: {
        applicationId_serverId: {
          applicationId,
          serverId,
        },
      },
      select: { id: true },
    });

    if (existing) {
      await tx.applicationServerMap.update({
        where: { id: existing.id },
        data: { status: toStatusValue(status) },
      });
      return;
    }

    const count = await tx.applicationServerMap.count({ where: { applicationId } });

    await tx.applicationServerMap.create({
      data: {
        id: createId(),
        applicationId,
        serverId,
        status: toStatusValue(status),
        isPrimary: count === 0,
      },
    });
  });
}

export async function setApplicationPrimaryServer(applicationId: string, serverId: string) {
  await prisma.$transaction(async (tx: any) => {
    const target = await tx.applicationServerMap.findUnique({
      where: {
        applicationId_serverId: {
          applicationId,
          serverId,
        },
      },
      select: { id: true },
    });

    if (!target) {
      throw new Error('Server mapping not found for this application.');
    }

    await tx.applicationServerMap.updateMany({
      where: {
        applicationId,
        isPrimary: true,
      },
      data: {
        isPrimary: false,
      },
    });

    await tx.applicationServerMap.update({
      where: { id: target.id },
      data: { isPrimary: true },
    });
  });
}

export async function getApplicationServerMapData(applicationId: string, selectedServerId?: string | null) {
  const rows = await prisma.applicationServerMap.findMany({
    where: { applicationId },
    include: {
      server: {
        select: {
          id: true,
          name: true,
        },
      },
    },
    orderBy: [{ isPrimary: 'desc' }, { server: { name: 'asc' } }],
  });

  const mappedRows = normalizeRows(rows, selectedServerId);
  const runningSection = resolveRunningSection(mappedRows, selectedServerId);

  return {
    maps: mappedRows,
    runningSection,
  };
}

import { prisma } from '@/services/prisma';
import { createId } from '@/services/shared/create-id';
import type { WebServiceConfig, WebServiceType } from '@/app/server/webservices/actions';

function mapWebService(record: {
  id: string;
  name: string | null;
  type: string;
  createdOn: Date;
  updatedOn: Date | null;
  createdBy: string;
  value: unknown;
  serverId: string | null;
  serverName: string | null;
}): WebServiceConfig {
  return {
    id: record.id,
    name: record.name ?? undefined,
    type: record.type as WebServiceType,
    created_on: record.createdOn.toISOString(),
    updated_on: record.updatedOn?.toISOString(),
    created_by: record.createdBy,
    value: record.value,
    serverId: record.serverId ?? undefined,
    serverName: record.serverName ?? undefined,
  };
}

export async function createWebService(data: {
  type: WebServiceType;
  name?: string;
  createdBy: string;
  value: any;
  serverId?: string;
  serverName?: string;
}) {
  const record = await prisma.webService.create({
    data: {
      id: createId(),
      type: data.type,
      name: data.name ?? null,
      createdBy: data.createdBy,
      value: data.value,
      serverId: data.serverId ?? null,
      serverName: data.serverName ?? null,
      createdOn: new Date(),
    },
  });

  return mapWebService(record);
}

export async function updateWebService(id: string, data: { value: any; name?: string }) {
  const record = await prisma.webService.update({
    where: { id },
    data: {
      value: data.value,
      ...(data.name !== undefined ? { name: data.name ?? null } : {}),
      updatedOn: new Date(),
    },
  });

  return mapWebService(record);
}

export async function deleteWebService(id: string) {
  return prisma.webService.delete({
    where: { id },
  });
}

export async function getWebServiceById(id: string) {
  const record = await prisma.webService.findUnique({
    where: { id },
  });

  return record ? mapWebService(record) : null;
}

export async function getAllWebServices() {
  const records = await prisma.webService.findMany({
    orderBy: { createdOn: 'desc' },
  });

  return records.map(mapWebService);
}

export async function getWebServicesByType(type: WebServiceType) {
  const records = await prisma.webService.findMany({
    where: { type },
    orderBy: { createdOn: 'desc' },
  });

  return records.map(mapWebService);
}

export async function getWebServicesByServerId(serverId: string) {
  const records = await prisma.webService.findMany({
    where: { serverId },
    orderBy: { createdOn: 'desc' },
  });

  return records.map(mapWebService);
}

export async function getLatestWebService(type: WebServiceType, serverId?: string) {
  const record = await prisma.webService.findFirst({
    where: {
      type,
      ...(serverId ? { serverId } : {}),
    },
    orderBy: { createdOn: 'desc' },
  });

  return record ? mapWebService(record) : null;
}

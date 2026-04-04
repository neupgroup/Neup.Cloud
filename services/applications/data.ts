import { Prisma } from '@prisma/client';
import type { Application, CreateApplicationData, UpdateApplicationData } from '@/app/server/applications/types';
import { prisma } from '@/services/prisma';
import { createId } from '@/services/shared/create-id';
import { buildSupervisorServiceName, generateSupervisorServiceToken } from './service-name';

function toJsonField(value: Prisma.InputJsonValue | null | undefined) {
  return value === undefined ? undefined : value === null ? Prisma.DbNull : value;
}

function mapApplication(record: {
  id: string;
  name: string;
  appIcon: string | null;
  location: string;
  language: string;
  repository: string | null;
  networkAccess: string[];
  commands: unknown;
  information: unknown;
  owner: string;
  createdAt: Date;
  updatedAt: Date;
  environments: unknown;
  files: unknown;
}): Application {
  return {
    id: record.id,
    name: record.name,
    appIcon: record.appIcon ?? undefined,
    location: record.location,
    language: record.language,
    repository: record.repository ?? undefined,
    networkAccess: record.networkAccess,
    commands: (record.commands as Record<string, string> | null) ?? undefined,
    information: (record.information as Record<string, any> | null) ?? undefined,
    owner: record.owner,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
    environments: (record.environments as Record<string, string> | null) ?? undefined,
    files: (record.files as Record<string, string> | null) ?? undefined,
  };
}

export async function getApplications() {
  const records = await prisma.application.findMany({
    orderBy: [{ updatedAt: 'desc' }, { name: 'asc' }],
  });

  return records.map(mapApplication);
}

export async function getApplicationById(id: string) {
  const record = await prisma.application.findUnique({
    where: { id },
  });

  return record ? mapApplication(record) : null;
}

export async function createApplication(data: CreateApplicationData) {
  const applicationId = createId();
  const information = {
    ...(data.information ?? {}),
    supervisorServiceName:
      data.information?.supervisorServiceName ??
      buildSupervisorServiceName(applicationId, generateSupervisorServiceToken()),
  };

  const record = await prisma.application.create({
    data: {
      id: applicationId,
      name: data.name,
      appIcon: data.appIcon ?? null,
      location: data.location,
      language: data.language,
      repository: data.repository ?? null,
      networkAccess: data.networkAccess ?? [],
      commands: toJsonField((data.commands ?? null) as Prisma.InputJsonValue | null),
      information: toJsonField(information as Prisma.InputJsonValue),
      owner: data.owner,
      createdAt: new Date(),
      updatedAt: new Date(),
      environments: toJsonField((data.environments ?? null) as Prisma.InputJsonValue | null),
      files: toJsonField((data.files ?? null) as Prisma.InputJsonValue | null),
    },
  });

  return mapApplication(record);
}

export async function updateApplication(id: string, data: UpdateApplicationData) {
  const existing = await prisma.application.findUnique({
    where: { id },
  });

  if (!existing) {
    throw new Error('Application not found');
  }

  const mergedInformation = data.information === undefined
    ? undefined
    : {
        ...((existing.information as Record<string, any> | null) ?? {}),
        ...data.information,
        supervisorServiceName:
          data.information?.supervisorServiceName ??
          (existing.information as Record<string, any> | null)?.supervisorServiceName,
      };

  const record = await prisma.application.update({
    where: { id },
    data: {
      ...(data.name !== undefined ? { name: data.name } : {}),
      ...(data.appIcon !== undefined ? { appIcon: data.appIcon ?? null } : {}),
      ...(data.location !== undefined ? { location: data.location } : {}),
      ...(data.language !== undefined ? { language: data.language } : {}),
      ...(data.repository !== undefined ? { repository: data.repository ?? null } : {}),
      ...(data.networkAccess !== undefined ? { networkAccess: data.networkAccess } : {}),
      ...(data.commands !== undefined ? { commands: toJsonField((data.commands ?? null) as Prisma.InputJsonValue | null) } : {}),
      ...(data.information !== undefined ? { information: toJsonField((mergedInformation ?? null) as Prisma.InputJsonValue | null) } : {}),
      ...(data.owner !== undefined ? { owner: data.owner } : {}),
      ...(data.environments !== undefined ? { environments: toJsonField((data.environments ?? null) as Prisma.InputJsonValue | null) } : {}),
      ...(data.files !== undefined ? { files: toJsonField((data.files ?? null) as Prisma.InputJsonValue | null) } : {}),
      updatedAt: new Date(),
    },
  });

  return mapApplication(record);
}

export async function deleteApplication(id: string) {
  return prisma.application.delete({
    where: { id },
  });
}

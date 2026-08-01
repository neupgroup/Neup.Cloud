import { prisma } from '@/core/database/prisma';

import type { Application, UpdateApplicationData } from './_types';
import { checkName, mapApplication, toJsonField } from './_utils';

export async function updateApplication(id: string, data: UpdateApplicationData): Promise<Application> {
  const existing = await prisma.application.findUnique({ where: { id } });
  if (!existing) throw new Error('Application not found');

  const mergedInformation =
    data.information === undefined
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
      ...(data.commands !== undefined ? { commands: toJsonField((data.commands ?? null)) } : {}),
      ...(data.information !== undefined ? { information: toJsonField((mergedInformation ?? null)) } : {}),
      ...(data.environments !== undefined ? { environments: toJsonField(data.environments ?? null) } : {}),
      ...(data.files !== undefined ? { files: toJsonField(data.files ?? null) } : {}),
      ...(data.owner !== undefined ? { owner: data.owner } : {}),
      updatedAt: new Date(),
    },
  });

  return mapApplication(record);
}

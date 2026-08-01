import { prisma } from '@/core/database/prisma';
import { stringUuid } from '@/core/data/uuid';

import type { Application, CreateApplicationData } from './_types';
import { checkName, mapApplication, toJsonField } from './_utils';

const SUPERVISOR_SERVICE_SEPARATOR = '_serving_';
const SUPERVISOR_SERVICE_TOKEN_LENGTH = 8;
const supervisorServiceTokenCharacters = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';

export function buildSupervisorServiceName(applicationId: string, token: string) {
  return `${applicationId}${SUPERVISOR_SERVICE_SEPARATOR}${token}`;
}

export function generateSupervisorServiceToken(length: number = SUPERVISOR_SERVICE_TOKEN_LENGTH) {
  return Array.from(
    { length },
    () => supervisorServiceTokenCharacters[Math.floor(Math.random() * supervisorServiceTokenCharacters.length)]
  ).join('');
}

export async function createApplication(data: CreateApplicationData): Promise<Application> {
  const applicationId = stringUuid();
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
      commands: toJsonField(data.commands ?? null),
      information: toJsonField(information),
      owner: data.owner,
      createdAt: new Date(),
      updatedAt: new Date(),
      environments: toJsonField(data.environments ?? null),
      files: toJsonField(data.files ?? null),
    },
  });

  return mapApplication(record);
}

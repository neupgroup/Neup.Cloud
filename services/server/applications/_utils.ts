import { Prisma } from '@/core/database/prisma';

import type { Application } from './_types';

export type SupervisorProcessLike = {
  name: string;
  state?: string;
  description?: string;
  pid?: number | null;
  uptime?: string | null;
  source?: 'supervisor';
  isPermanent?: boolean;
};

export function toJsonField(value: unknown) {
  return value === undefined ? undefined : value === null ? Prisma.DbNull : value;
}

export function mapApplication(record: any): Application {
  return {
    id: record.id,
    name: record.name,
    appIcon: record.appIcon ?? undefined,
    location: record.location,
    language: record.language,
    repository: record.repository ?? undefined,
    networkAccess: record.networkAccess ?? [],
    commands: (record.commands as Record<string, string> | null) ?? undefined,
    information: (record.information as Record<string, any> | null) ?? undefined,
    owner: record.owner,
    createdAt: record.createdAt?.toISOString?.() ?? record.createdAt,
    updatedAt: record.updatedAt?.toISOString?.() ?? record.updatedAt,
    environments: (record.environments as Record<string, string> | null) ?? undefined,
    files: (record.files as Record<string, string> | null) ?? undefined,
  };
}

export function checkName(name: string): boolean {
  return /^[a-zA-Z0-9-_]{1,64}$/.test(name);
}

export function getName(app: Application): string {
  return app.name;
}

export function updateName(app: Application, newName: string): Application {
  if (!checkName(newName)) throw new Error('Invalid name');
  return { ...app, name: newName };
}

function normalizeProcessName(value?: string) {
  return (value || '').trim().toLowerCase();
}

export function findBestSupervisorProcessForApplication(
  applicationId: string,
  processes: SupervisorProcessLike[],
  expectedServiceName?: string
) {
  if (!Array.isArray(processes) || processes.length === 0) {
    return null;
  }

  const normalizedApplicationId = normalizeProcessName(applicationId);
  const normalizedExpectedServiceName = normalizeProcessName(expectedServiceName);

  if (normalizedExpectedServiceName) {
    const exactExpected = processes.find(
      (process) => normalizeProcessName(process.name) === normalizedExpectedServiceName
    );
    if (exactExpected) return exactExpected;
  }

  const exactIdMatch = processes.find(
    (process) => normalizeProcessName(process.name) === normalizedApplicationId
  );
  if (exactIdMatch) return exactIdMatch;

  const generatedServiceMatch = processes.find((process) => {
    const normalizedName = normalizeProcessName(process.name);
    return normalizedName.startsWith(`${normalizedApplicationId}_serving_`);
  });
  if (generatedServiceMatch) return generatedServiceMatch;

  const fuzzyMatch = processes.find((process) => {
    const normalizedName = normalizeProcessName(process.name);
    return (
      normalizedName.includes(normalizedApplicationId) ||
      normalizedApplicationId.includes(normalizedName)
    );
  });

  return fuzzyMatch ?? null;
}

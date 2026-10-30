import { randomUUID } from 'node:crypto';

import { prisma } from '@neup/core/database/prisma';

type CreateLoggerActivityInput = {
  projectId: string;
  type?: string;
  data: unknown;
};

export async function createLoggerProject(input: {
  name: string; ingestKey: string; allowLocalhostErrors: boolean;
  allowWithoutOrigin: boolean; allowedErrorDomains: string[];
  errorsPerMinute: number; errorsPerTenMinutes: number;
}) {
  return prisma.project.create({ data: { id: randomUUID(), createdOn: new Date(), ...input } });
}

// Finds one logger project by its stable ID for its management page.
export async function getLoggerProjectById(projectId: string) {
  return prisma.project.findUnique({ where: { id: projectId } });
}

// Rotates the project ingest key, immediately invalidating the previous key.
export async function rotateLoggerProjectIngestKey(projectId: string, ingestKey: string) {
  return prisma.project.update({ where: { id: projectId }, data: { ingestKey } });
}

export async function countRecentErrors(projectId: string, since: Date) {
  return prisma.loggerActivity.count({ where: { projectId, type: 'error', loggedOn: { gte: since } } });
}

export async function createLoggerActivity(input: CreateLoggerActivityInput) {
  return prisma.loggerActivity.create({
    data: {
      id: randomUUID(),
      projectId: input.projectId,
      type: input.type,
      data: input.data as object,
      loggedOn: new Date(),
    },
    include: {
      project: true,
    },
  });
}

export async function getLoggerActivities() {
  return prisma.loggerActivity.findMany({
    include: {
      project: true,
    },
    orderBy: {
      loggedOn: 'desc',
    },
  });
}

export async function getPaginatedLoggerActivities(page = 1, pageSize = 25) {
  const safePage = Math.max(1, Math.floor(page));
  const safePageSize = Math.max(1, Math.floor(pageSize));

  const total = await prisma.loggerActivity.count();
  const totalPages = Math.max(1, Math.ceil(total / safePageSize));
  const currentPage = Math.min(safePage, totalPages);
  const activities = await prisma.loggerActivity.findMany({
    include: {
      project: true,
    },
    orderBy: {
      loggedOn: 'desc',
    },
    skip: (currentPage - 1) * safePageSize,
    take: safePageSize,
  });

  return {
    activities,
    currentPage,
    totalPages,
    total,
  };
}

export async function getLoggerActivitiesByType(type: string) {
  return prisma.loggerActivity.findMany({
    where: {
      type,
    },
    include: {
      project: true,
    },
    orderBy: {
      loggedOn: 'desc',
    },
  });
}

export async function getLoggerProjects() {
  return prisma.project.findMany({ orderBy: { name: 'asc' } });
}

export async function getLoggerActivitiesByProject(projectId: string, page = 1, pageSize = 25) {
  const total = await prisma.loggerActivity.count({ where: { projectId } });
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const currentPage = Math.min(Math.max(1, page), totalPages);
  const activities = await prisma.loggerActivity.findMany({ where: { projectId }, include: { project: true }, orderBy: { loggedOn: 'desc' }, skip: (currentPage - 1) * pageSize, take: pageSize });
  return { activities, currentPage, totalPages, total };
}
